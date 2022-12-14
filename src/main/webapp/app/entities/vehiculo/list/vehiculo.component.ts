import { Component, OnInit } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Data, ParamMap, Router } from '@angular/router';
import { combineLatest, filter, Observable, switchMap, tap } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { IVehiculo } from '../vehiculo.model';

import { ITEMS_PER_PAGE } from 'app/config/pagination.constants';
import { ASC, DESC, SORT, ITEM_DELETED_EVENT, DEFAULT_SORT_DATA } from 'app/config/navigation.constants';
import { EntityArrayResponseType, VehiculoService } from '../service/vehiculo.service';
import { VehiculoDeleteDialogComponent } from '../delete/vehiculo-delete-dialog.component';
import { ParseLinks } from 'app/core/util/parse-links.service';
import { ThisReceiver } from '@angular/compiler';

@Component({
  selector: 'jhi-vehiculo',
  templateUrl: './vehiculo.component.html',
  styleUrls: ['./vehiculo.component.scss'],
})
export class VehiculoComponent implements OnInit {
  vehiculos?: IVehiculo[]; //lISTA QUE SE MUESTRA EN PANTALLA
  isLoading = false;

  predicate = 'id';
  ascending = true;

  itemsPerPage = ITEMS_PER_PAGE;
  links: { [key: string]: number } = {
    last: 0,
  };
  page = 1;

  constructor(
    protected vehiculoService: VehiculoService,
    protected activatedRoute: ActivatedRoute,
    public router: Router,
    protected parseLinks: ParseLinks,
    protected modalService: NgbModal
  ) {}

  reset(): void {
    this.page = 1;
    this.vehiculos = [];
    this.load();
  }

  loadPage(page: number): void {
    this.page = page;
    this.load();
  }

  trackId = (_index: number, item: IVehiculo): number => this.vehiculoService.getVehiculoIdentifier(item);

  ngOnInit(): void {
    this.load();
  }

  delete(vehiculo: IVehiculo): void {
    const modalRef = this.modalService.open(VehiculoDeleteDialogComponent, { size: 'lg', backdrop: 'static' });
    modalRef.componentInstance.vehiculo = vehiculo;
    // unsubscribe not needed because closed completes on modal close
    modalRef.closed
      .pipe(
        filter(reason => reason === ITEM_DELETED_EVENT),
        switchMap(() => this.loadFromBackendWithRouteInformations())
      )
      .subscribe({
        next: (res: EntityArrayResponseType) => {
          this.onResponseSuccess(res);
        },
      });
  }

  load(): void {
    this.loadFromBackendWithRouteInformations().subscribe({
      next: (res: EntityArrayResponseType) => {
        this.onResponseSuccess(res);
      },
    });
  }

  loadDisponibles(): void {
    this.vehiculoService.getDisponibles().subscribe({
      next: (res: EntityArrayResponseType) => {
        if (res.body != null) {
          this.onSuccess(res.body);
        }
      },
    });
  }

  loadNoDisponibles(): void {
    this.vehiculoService.getNoDisponibles().subscribe({
      next: (res: EntityArrayResponseType) => {
        this.onResponseSuccess(res);
      },
    });
  }

  navigateToWithComponentValues(): void {
    this.handleNavigation(this.page, this.predicate, this.ascending);
  }

  navigateToPage(page = this.page): void {
    this.handleNavigation(page, this.predicate, this.ascending);
  }

  protected loadFromBackendWithRouteInformations(): Observable<EntityArrayResponseType> {
    return combineLatest([this.activatedRoute.queryParamMap, this.activatedRoute.data]).pipe(
      tap(([params, data]) => this.fillComponentAttributeFromRoute(params, data)),
      switchMap(() => this.queryBackend(this.page, this.predicate, this.ascending))
    );
  }

  protected fillComponentAttributeFromRoute(params: ParamMap, data: Data): void {
    const sort = (params.get(SORT) ?? data[DEFAULT_SORT_DATA]).split(',');
    this.predicate = sort[0];
    this.ascending = sort[1] === ASC;
  }

  protected onResponseSuccess(response: EntityArrayResponseType): void {
    this.fillComponentAttributesFromResponseHeader(response.headers);
    const dataFromBody = this.fillComponentAttributesFromResponseBody(response.body);
    this.vehiculos = dataFromBody;
  }

  protected onSuccess(dataFromBody: IVehiculo[]): void {
    this.vehiculos = dataFromBody;
  }

  protected fillComponentAttributesFromResponseBody(data: IVehiculo[] | null): IVehiculo[] {
    const vehiculosNew = this.vehiculos ?? [];
    if (data) {
      for (const d of data) {
        if (vehiculosNew.map(op => op.id).indexOf(d.id) === -1) {
          vehiculosNew.push(d);
        }
      }
    }
    return vehiculosNew;
  }

  protected fillComponentAttributesFromResponseHeader(headers: HttpHeaders): void {
    const linkHeader = headers.get('link');
    if (linkHeader) {
      this.links = this.parseLinks.parse(linkHeader);
    } else {
      this.links = {
        last: 0,
      };
    }
  }

  protected queryBackend(page?: number, predicate?: string, ascending?: boolean): Observable<EntityArrayResponseType> {
    this.isLoading = true;
    const pageToLoad: number = page ?? 1;
    const queryObject = {
      page: pageToLoad - 1,
      size: this.itemsPerPage,
      sort: this.getSortQueryParam(predicate, ascending),
    };
    return this.vehiculoService.query(queryObject).pipe(tap(() => (this.isLoading = false)));
  }

  protected queryBackendDisponible(): Observable<EntityArrayResponseType> {
    this.isLoading = true;
    return this.vehiculoService.getDisponibles().pipe(tap(() => (this.isLoading = false)));
  }

  protected handleNavigation(page = this.page, predicate?: string, ascending?: boolean): void {
    const queryParamsObj = {
      page,
      size: this.itemsPerPage,
      sort: this.getSortQueryParam(predicate, ascending),
    };

    this.router.navigate(['./'], {
      relativeTo: this.activatedRoute,
      queryParams: queryParamsObj,
    });
  }

  protected getSortQueryParam(predicate = this.predicate, ascending = this.ascending): string[] {
    const ascendingQueryParam = ascending ? ASC : DESC;
    if (predicate === '') {
      return [];
    } else {
      return [predicate + ',' + ascendingQueryParam];
    }
  }

  protected reservar(vehiculo: IVehiculo): void {
    this.vehiculoService.reservarVehiculo(vehiculo.id).subscribe({
      next: () => this.reset(),
    });
  }
}
