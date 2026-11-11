import * as bootstrap from 'bootstrap';
import { watchCurrentUser } from './auth.js';

const frame = document.getElementById('content-frame');
const sidebarEl = document.getElementById('sidebar');
const links = [...document.querySelectorAll('#sidebar-nav .nav-link')];

function showPage() {
    const link = links.find((l) => l.getAttribute('href') === location.hash) ?? links[0];

    links.forEach((l) => {
        const active = l === link;
        l.classList.toggle('active', active);
        if (active) l.setAttribute('aria-current', 'page');
        else l.removeAttribute('aria-current');
    });

    const src = link.dataset.src;
    if (frame.getAttribute('src') !== src) frame.setAttribute('src', src);
    document.title = `${link.textContent.trim()} - TRE Portal`;

    bootstrap.Offcanvas.getInstance(sidebarEl)?.hide();
}

window.addEventListener('hashchange', showPage);
showPage();

const userBox = document.getElementById('sidebar-user');
const userName = document.getElementById('sidebar-user-name');
watchCurrentUser(({ name, username }) => {
    userName.textContent = name;
    userBox.title = username;
    userBox.hidden = false;
}).catch(() => {});
