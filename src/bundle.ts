import { join } from 'path';
import { parse } from 'acorn';
import { generate } from 'escodegen';

import { IHost, DefaultHost } from './host';
import { getModulePath } from './module-path';
import { enqueueModule, bundleNextModule } from './modules';
import { IDetectedGlobals, injectGlobals } from './globals';

export type SourceValues =
    'es5'
  | 'es6' | 'es2015';

export interface IBundleOptions {
  entryPoint?: string;
  configFile?: string;
  watchMode?: boolean;
  source?: SourceValues;
}

export interface IConfig {
  entryPoint: string;
  source: SourceValues;
  watchMode: boolean;
}

function createConfig(options: IBundleOptions, host: IHost): IConfig {
  const config: IConfig = {} as any;

  const configPath = host.joinPath(host.cwd(), options.configFile || 'paeckchen.json');
  let configFile: any = {};
  if (host.fileExists(configPath)) {
    configFile = JSON.parse(host.readFile(configPath));
  }

  config.entryPoint = options.entryPoint || configFile.entry;
  config.source = options.source || configFile.source || 'es2015';
  config.watchMode = options.watchMode || configFile.watchMode;

  return config;
}

function getModules(ast: ESTree.Program): ESTree.ArrayExpression {
  return (ast as any).body[2].declarations[0].init;
}

const paeckchenSource = `
  var __paeckchen_cache__ = [];
  function __paeckchen_require__(index) {
    if (!(index in __paeckchen_cache__)) {
      __paeckchen_cache__[index] = {
        module: {
          exports: {}
        }
      };
      modules[index](__paeckchen_cache__[index].module, __paeckchen_cache__[index].module.exports);
    }
    return __paeckchen_cache__[index].module;
  }
  var modules = [];
  __paeckchen_require__(0);
`;

export function bundle(options: IBundleOptions, host: IHost = new DefaultHost()): string {
  const config = createConfig(options, host);

  const detectedGlobals: IDetectedGlobals = {
    global: false,
    process: false,
    buffer: false
  };
  const paeckchenAst = parse(paeckchenSource);
  const modules = getModules(paeckchenAst).elements;
  const absoluteEntryPath = join(host.cwd(), config.entryPoint);
  // start bundling...
  enqueueModule(getModulePath('.', absoluteEntryPath, host));
  while (bundleNextModule(modules, host, detectedGlobals)) {
    process.stderr.write('.');
  }
  // ... when ready inject globals...
  injectGlobals(detectedGlobals, paeckchenAst, host);
  // ... and bundle global dependencies
  while (bundleNextModule(modules, host, detectedGlobals)) {
    process.stderr.write('.');
  }
  process.stderr.write('\n');

  return generate(paeckchenAst, {
    comment: true
  });
}
