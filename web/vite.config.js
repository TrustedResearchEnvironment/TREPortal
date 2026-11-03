import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const page = (p) => resolve(import.meta.dirname, p);

export default defineConfig({
  // Relative asset paths so the build works under any sub-path (nginx, GitHub Pages).
  base: './',
  build: {
    rollupOptions: {
      input: {
        requestHub: page('Dashboards/RequestsHub/RequestHub.html'),
        approver: page('Dashboards/Approver/approver.html'),
        welcome: page('Dashboards/Welcome/Matrix/welcome.html'),
        welcomeSearch: page('Dashboards/Welcome/Matrix/search.html'),
        adminRequestHub: page('AdminDashboards/AdminRequestHub/AdminRequestHub.html'),
        dataSource: page('AdminDashboards/DataSource/dataSourcePlatformAdmin.html'),
        dataSourceTypes: page('AdminDashboards/DataSourceTypes/dataSouceTypesPlatformAdmini.html'),
        emailTemplate: page('AdminDashboards/EmailTemplate/emailTemplatePlatformAdmin.html'),
        manageDataSets: page('AdminDashboards/ManageDataSets/manageDataSets.html'),
        metaData: page('AdminDashboards/MetaData/metaDataPlatformAdmin.html'),
      },
    },
  },
});
