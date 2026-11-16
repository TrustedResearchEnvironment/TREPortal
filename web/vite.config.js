import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const page = (p) => resolve(import.meta.dirname, p);
const commitHash = process.env.GITHUB_SHA
  ?? process.env.VITE_COMMIT_SHA
  ?? execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();

export default defineConfig({
  // Relative asset paths so the build works under any sub-path (nginx, GitHub Pages).
  base: './',
  define: {
    __TRE_COMMIT_HASH__: JSON.stringify(commitHash.slice(0, 7)),
  },
  // Dev server only. Forwards /api to the app container (nginx adds the API key headers).
  // Defaults to the published compose port for host-run `npm run dev`.
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        index: page('index.html'),
        authRedirect: page('auth-redirect.html'),
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
