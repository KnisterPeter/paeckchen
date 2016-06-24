import { resolve } from 'path';
import { parse } from 'acorn';

import { IHost } from './host';
import * as defaultPlugins from './plugins';

interface IWrappedModule {
  index: number;
  name: string;
  ast?: ESTree.Statement;
  inProcess: boolean;
}

const wrappedModules: {[name: string]: IWrappedModule} = {};
let nextModuleIndex = 0;

export function reset(): void {
  Object.keys(wrappedModules).forEach(key => delete wrappedModules[key]);
  nextModuleIndex = 0;
}

export function getModuleIndex(name: string): number {
  const moduleName = name.replace(/\.js$/, '');
  if (wrappedModules[moduleName]) {
    return wrappedModules[moduleName].index;
  }
  const index = nextModuleIndex++;
  wrappedModules[moduleName] = {
    index,
    name: moduleName,
    inProcess: false
  };
  return index;
}

function isModuleReadyOrInProgress(name: string): boolean {
  return Boolean(wrappedModules[name] && (wrappedModules[name].inProcess || wrappedModules[name].ast));
}

export function updateModule(name: string): void {
  if (wrappedModules[name]) {
    wrappedModules[name].ast = undefined;
    wrappedModules[name].inProcess = false;
  }
}

function createModuleWrapper(name: string, moduleAst: ESTree.Program): IWrappedModule {
  function getWrapperBlock(ast: any): ESTree.BlockStatement {
    return (ast as ESTree.FunctionDeclaration).body as ESTree.BlockStatement;
  }

  const index = getModuleIndex(name);
  const wrapperSource = `
    function _${index}() {
      var module = {
        exports: {}
      };
      var exports = module.exports;
      return module;
    }
  `;
  const wrapperAst = parse(wrapperSource).body[0];

  let wrapperBlock = getWrapperBlock(wrapperAst);
  wrapperBlock.body = [
    ...wrapperBlock.body.slice(0, wrapperBlock.body.length - 1),
    ...moduleAst.body,
    ...wrapperBlock.body.slice(wrapperBlock.body.length - 1)] as ESTree.Statement[];

  return {
    index,
    name,
    ast: wrapperAst,
    inProcess: false
  };
}

export function wrapModule(modulePath: string, modules: (ESTree.Expression | ESTree.SpreadElement)[],
    host: IHost, plugins: any = defaultPlugins): void {
  const resolvedPath = resolve(modulePath);
  const moduleName = resolvedPath.replace(/\.js$/, '');
  // Short cut for already processed imports
  if (isModuleReadyOrInProgress(moduleName)) {
    return;
  }
  // Prefill module indices
  getModuleIndex(moduleName);
  wrappedModules[moduleName].inProcess = true;
  try {
    const moduleAst = parse(host.readFile(resolvedPath).toString(), {
      ecmaVersion: 7,
      sourceType: 'module',
      locations: true,
      ranges: true,
      allowHashBang: true
    });

    Object.keys(plugins).forEach(plugin => {
      plugins[plugin](moduleAst, moduleName, modules, host);
    });

    const wrappedModule = createModuleWrapper(moduleName, moduleAst);
    wrappedModules[wrappedModule.name] = wrappedModule;
    modules[wrappedModule.index] = wrappedModule.ast;
  } catch (e) {
    console.error(`Failed to process module '${modulePath}'`);
    throw e;
  }
  wrappedModules[moduleName].inProcess = false;
}
