import {Capacitor} from '@capacitor/core';
// Native launches go straight to sign-in; the web homepage keeps its public route.
if(Capacitor.isNativePlatform()&&window.location.pathname==='/'&&!window.location.hash&&!window.location.search)window.history.replaceState(null,'','/login');
