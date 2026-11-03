// Exposes the libraries that page scripts reference as globals (bootstrap.Modal, XLSX).
import * as bootstrap from 'bootstrap';
import * as XLSX from 'xlsx';

window.bootstrap = bootstrap;
window.XLSX = XLSX;
