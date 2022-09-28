import { DataState } from "../enum/data-state.emum";

export interface AppState<T>{
    dataState: DataState;
    appData?: T;
    error?:string;
}