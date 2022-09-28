import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import {
  BehaviorSubject,
  catchError,
  map,
  Observable,
  of,
  startWith,
} from 'rxjs';
import { DataState } from './enum/data-state.emum';
import { Status } from './enum/status.enum';
import { AppState } from './interface/app-state';
import { CustomResponse } from './interface/custom-response';
import { Server } from './interface/server';
import { NotificationService } from './service/notification.service';
import { ServerService } from './service/server.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit {
  // title = 'serverapp';
  appState$!: Observable<AppState<CustomResponse>>;
  readonly DataState = DataState;
  readonly Status = Status;
  private filterSubject = new BehaviorSubject<string>('');
  private dataSubject = new BehaviorSubject<CustomResponse>(null!);
  filterStatus$ = this.filterSubject.asObservable();
  private isLoading = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoading.asObservable();

  constructor(private serverService: ServerService, private notifier: NotificationService) {}

  ngOnInit(): void {
    this.appState$ = this.serverService.servers$.pipe(
      map((response) => {
        this.notifier.onDefault(response.message);
        this.dataSubject.next(response);
        return {
          dataState: DataState.LOADED_STATE,
          appData: {
            ...response,
            data: { servers: response.data.servers!.reverse() },
          },
        };
      }),
      //wait request
      startWith({ dataState: DataState.LOADING_STATE }),
      catchError((error: string) => {
        //si tiene el mismo nombre se omite la asignación en el objeto (caso de error)
        this.notifier.onError(error);
        return of({ dataState: DataState.ERROR_STATE, error });
      })
    );
  }

  pingServer(ipAddres: string): void {
    //muestra spinner
    this.filterSubject.next(ipAddres);
    this.appState$ = this.serverService.ping$(ipAddres).pipe(
      map((response) => {
        //actualiza el server que retorna el back end por medio de la posición en el arreglo
        this.dataSubject.value.data.servers![
          this.dataSubject.value.data.servers!.findIndex(
            (server) => server.id === response.data.server!.id
          )
        ] = response.data.server!;
        this.notifier.onDefault(response.message);
        //detiene el spinner (condición)
        this.filterSubject.next('');

        return {
          dataState: DataState.LOADED_STATE,
          appData: this.dataSubject.value,
        };
      }),
      //wait request
      startWith({
        dataState: DataState.LOADED_STATE,
        appData: this.dataSubject.value,
      }),
      catchError((error: string) => {
        //detiene el spinner (condición)
        this.filterSubject.next('');
        this.notifier.onError(error);
        //si tiene el mismo nombre se omite la asignación en el objeto (caso de error)
        return of({ dataState: DataState.ERROR_STATE, error });
      })
    );
  }

  filterServers(status: Status): void {
    this.appState$ = this.serverService
      .filter$(status, this.dataSubject.value)
      .pipe(
        map((response) => {
          // console.log(status);
          this.notifier.onDefault(response.message);
          return {
            dataState: DataState.LOADED_STATE,
            appData: response,
          };
        }),
        //wait request
        startWith({
          dataState: DataState.LOADED_STATE,
          appData: this.dataSubject.value,
        }),
        catchError((error: string) => {
          this.notifier.onError(error);
          //si tiene el mismo nombre se omite la asignación en el objeto (caso de error)
          return of({ dataState: DataState.ERROR_STATE, error });
        })
      );
  }

  saveServer(serverForm: NgForm): void {
    //muestra spinner
    this.isLoading.next(true);
    this.appState$ = this.serverService.save$(<Server>serverForm.value).pipe(
      map((response) => {
        this.dataSubject.next({
          ...response,
          data: {
            servers: [
              response.data.server!,
              ...this.dataSubject.value.data.servers!,
            ],
          },
        });
        this.notifier.onDefault(response.message);
        document.getElementById('closeModal')!.click();
        this.isLoading.next(false);
        serverForm.resetForm({ status: this.Status.SERVER_DOWN });
        return {
          dataState: DataState.LOADED_STATE,
          appData: this.dataSubject.value,
        };
      }),
      //wait request
      startWith({
        dataState: DataState.LOADED_STATE,
        appData: this.dataSubject.value,
      }),
      catchError((error: string) => {
        //detiene el spinner (condición)
        this.isLoading.next(false);
        this.notifier.onError(error);
        return of({ dataState: DataState.ERROR_STATE, error });
      })
    );
  }

  deleteServer(server: Server): void {
    this.appState$ = this.serverService.delete$(server.id).pipe(
      map((response) => {
        this.dataSubject.next({
          ...response,
          data: {
            servers: this.dataSubject.value.data.servers!.filter(
              (s) => s.id !== server.id
            ),
          },
        });
        this.notifier.onDefault(response.message);
        return {
          dataState: DataState.LOADED_STATE,
          appData: this.dataSubject.value,
        };
      }),
      //wait request
      startWith({
        dataState: DataState.LOADED_STATE,
        appData: this.dataSubject.value,
      }),
      catchError((error: string) => {
        this.notifier.onError(error);
        return of({ dataState: DataState.ERROR_STATE, error });
      })
    );
  }

  printReport(): void {
    //pdf format
    // window.print();
    this.notifier.onDefault('Report downloaded');
    //excel format
    let dataType = 'application/vnd.ms-excel.sheet.macroEnabled.12';
    let tableSelect = document.getElementById('servers');
    let tableHtml = tableSelect!.outerHTML.replace(/ /g, '%20');
    let downloadLink = document.createElement('a');
    document.body.appendChild(downloadLink);
    downloadLink.href = 'data:' + dataType + ', ' + tableHtml;
    downloadLink.download = 'server-report.xls';
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }
}
