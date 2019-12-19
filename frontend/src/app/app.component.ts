import { Component, OnInit } from '@angular/core';
import * as shortid from 'shortid';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  tenants: any = [];
  accessControl: any = {};
  selectedTenant: any = null;
  apis: any = [];
  editTenant: any = null;

  accounts: any[] = [];

  newTenant() {
    this.editTenant = {
      id: "",
      url: ""
    }
    this.accounts = [];

  }

  async editTenants(tenant) {
    try {
    await fetch(`/api/tenants/${tenant.id}/accounts`).then((response) => response.json()).then((accounts) => this.accounts = accounts)
    }catch (e){
      alert('não foi possível obter as contas para vinculo no tenant')
    }
    this.editTenant = tenant;
  }

  saveTenant() {
    fetch(`/api/tenants`, { method: 'put', headers: { 'content-type': 'application/json' }, body: JSON.stringify(this.editTenant) }).then((response) => response.json()).then((tenant) => { alert('tenant configured'); })
    this.editTenant = null;
    this.fetchTenants();
  }

  fetchTenants() {
    fetch('/api/tenants').then((response) => response.json()).then((tenants) => this.tenants = tenants)
  }

  ngOnInit() {
    this.fetchTenants();
  }


  async selectTenant(tenant) {
    return new Promise(async (resolve, reject) => {
      try {
        await Promise.all([
          fetch(`/api/tenants/${tenant.id}/apis`).then((response) => response.json()).then((apis) => this.apis = apis),
          fetch(`/api/tenants/${tenant.id}/access-control`).then((response) => response.json()).then((accessControl) => this.accessControl = accessControl)
        ]);
        this.selectedTenant = tenant;
        resolve();
      } catch (e) {
        alert('Não foi possível obter apis');
        console.log(e);
        reject(e);
      }
    });
  }


  newApplication() {
    this.accessControl['access-control'].push({ applicationName: "new app", applicationKey: shortid.generate(), apis: {} });
  }

  deleteApplication(app) {
    this.accessControl['access-control'] = this.accessControl['access-control'].filter(h => !(h.applicationKey === app.applicationKey && h.applicationName === app.applicationName));
  }

  back() {
    this.selectedTenant = null;
    this.editTenant = null;
    this.fetchTenants();
  }

  deleteTenant(tenant) {
    if (confirm(`Confirm delete tenant: ${tenant.id}?`)) {
      fetch(`/api/tenants/${tenant.id}`, { method: 'delete' }).then((tenant) => {
        this.fetchTenants();
      });
    }
  }

  generate(app) {
    app.applicationKey = shortid.generate();
  }

  apply() {
    fetch(`/api/tenants/${this.selectedTenant.id}/access-control`, { method: 'put', headers: { 'content-type': 'application/json' }, body: JSON.stringify(this.accessControl) }).then((response) => response.json()).then((accessControl) => { alert('configuration applied'); })
  }


}
