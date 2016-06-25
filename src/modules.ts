import { parse } from 'acorn';
import { builders as b } from 'ast-types';

import { IHost } from './host';
import * as defaultPlugins from './plugins';

interface IWrappedModule {
  index: number;
  name: string;
  ast?: ESTree.Statement;
}

const wrappedModules: {[name: string]: IWrappedModule} = {};
let nextModuleIndex = 0;

export function reset(): void {
  Object.keys(wrappedModules).forEach(key => delete wrappedModules[key]);
  nextModuleIndex = 0;
}

export function getModuleIndex(moduleName: string): number {
  if (wrappedModules[moduleName]) {
    return wrappedModules[moduleName].index;
  }
  const index = nextModuleIndex++;
  wrappedModules[moduleName] = {
    index,
    name: moduleName
  };
  return index;
}

export function updateModule(moduleName: string): void {
  if (wrappedModules[moduleName]) {
    wrappedModules[moduleName].ast = undefined;
  }
}

function createModuleWrapper(name: string, moduleAst: ESTree.Program): IWrappedModule {
  function getWrapperBlock(ast: any): ESTree.BlockStatement {
    return (ast as any).body.body[0].consequent.body[1].expression.callee.body;
  }

  const index = getModuleIndex(name);
  const wrapperSource = `
    function _${index}() {
      if (!_${index}.module) {
        _${index}.module = {
          exports: {}
        };
        (function(module, exports) {})(_${index}.module, _${index}.module.exports);
      }
      return _${index}.module;
    }
  `;
  const wrapperAst = parse(wrapperSource).body[0];
  getWrapperBlock(wrapperAst).body = moduleAst.body;

  return {
    index,
    name,
    ast: wrapperAst
  };
}

const moduleBundleQueue: string[] = [];
export function enqueueModule(modulePath: string): void {
  if (moduleBundleQueue.indexOf(modulePath) === -1) {
    moduleBundleQueue.push(modulePath);
  }
}

export function bundleNextModule(modules: (ESTree.Expression | ESTree.SpreadElement)[],
    host: IHost, plugins: any = defaultPlugins): boolean {
  if (moduleBundleQueue.length === 0) {
    return false;
  }
  const modulePath = moduleBundleQueue.shift();
  wrapModule(modulePath, modules, host, plugins);
  return true;
}

function wrapModule(modulePath: string, modules: (ESTree.Expression | ESTree.SpreadElement)[],
    host: IHost, plugins: any): void {
  // Prefill module indices
  getModuleIndex(modulePath);
  if (wrappedModules[modulePath].ast !== undefined) {
    // Module is already up to date
    return;
  }

  try {
    let moduleAst: ESTree.Program;
    if (!host.fileExists(modulePath)) {
      moduleAst = b.program([
        b.throwStatement(
          b.literal(`Module ${modulePath} not found`)
        )
      ]);
    } else {
      moduleAst = parse(host.readFile(modulePath).toString(), {
        ecmaVersion: 7,
        sourceType: 'module',
        locations: true,
        ranges: true,
        allowHashBang: true
      });
      Object.keys(plugins).forEach(plugin => {
        plugins[plugin](moduleAst, modulePath, host);
      });
    }

    const wrappedModule = createModuleWrapper(modulePath, moduleAst);
    wrappedModules[wrappedModule.name] = wrappedModule;
    modules[wrappedModule.index] = wrappedModule.ast;
  } catch (e) {
    console.error(`Failed to process module '${modulePath}'`);
    throw e;
  }
}
