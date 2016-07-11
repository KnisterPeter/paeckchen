import { IDetectedGlobals } from './globals';

export interface IWrappedModule {
  index: number;
  name: string;
  ast?: ESTree.Statement;
  remove: boolean;
}

export class State {

  private _detectedGlobals: IDetectedGlobals = {
    global: false,
    process: false,
    buffer: false
  };

  private _modules: (ESTree.Expression | ESTree.SpreadElement)[];

  private _wrappedModules: { [name: string]: IWrappedModule } = {};

  private _nextModuleIndex: number = 0;

  private _moduleWatchCallbackAdded: boolean = false;

  constructor(modules: (ESTree.Expression | ESTree.SpreadElement)[]) {
    this._modules = modules;
  }

  public get detectedGlobals(): IDetectedGlobals {
    return this._detectedGlobals;
  }

  public get modules(): (ESTree.Expression | ESTree.SpreadElement)[] {
    return this._modules;
  }

  public get wrappedModules(): { [name: string]: IWrappedModule } {
    return this._wrappedModules;
  }

  public getAndIncrementModuleIndex(): number {
    return this._nextModuleIndex++;
  }

  public get moduleWatchCallbackAdded(): boolean {
    return this._moduleWatchCallbackAdded;
  }

  public set moduleWatchCallbackAdded(watchCallbackAdded: boolean) {
    this._moduleWatchCallbackAdded = watchCallbackAdded;
  }

}
