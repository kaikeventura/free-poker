
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/free-poker/',
  locale: undefined,
  routes: [
  {
    "renderMode": 2,
    "route": "/free-poker"
  },
  {
    "renderMode": 2,
    "route": "/free-poker/room"
  },
  {
    "renderMode": 2,
    "redirectTo": "/free-poker",
    "route": "/free-poker/**"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 727, hash: '908f9d4e62d99d37598f251d1ad2a997c673717f6a7f29a9b26d3620f173977a', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 1012, hash: '16b7c667ae009e8cd4bd43a4435eb2afe258c4ef0e87771194dc2f25e82db361', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'index.html': {size: 231, hash: '95b0549451393558480f08f8e0970214c70e476b9c95b697c15c37fa7d6b6dc0', text: () => import('./assets-chunks/index_html.mjs').then(m => m.default)},
    'room/index.html': {size: 231, hash: '95b0549451393558480f08f8e0970214c70e476b9c95b697c15c37fa7d6b6dc0', text: () => import('./assets-chunks/room_index_html.mjs').then(m => m.default)},
    'styles-QMYRVNSK.css': {size: 103, hash: '6Y9YhboPl5Q', text: () => import('./assets-chunks/styles-QMYRVNSK_css.mjs').then(m => m.default)}
  },
};
