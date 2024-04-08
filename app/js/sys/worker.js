/*!
* Progressive Web App - Service Worker for Touch UI
* Copyright 2022-2024 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/
const appVersion = '$AppVersion';
const assets = [];
const staticCacheName = 'static';
const userCacheName = 'user';

function resolveClientUrl(url) {
    var scriptUrl = self.serviceWorker.scriptURL;
    scriptUrl = scriptUrl.substring(0, scriptUrl.length - 'worker.js'.length);
    return url.replace('~/', scriptUrl);
}

self.addEventListener('install', e => {
    assets.push(resolveClientUrl("~/pages/offline"));
    e.waitUntil(new Promise((resolve, reject) => {
        var openRequest = indexedDB.open("offline", 1);
        openRequest.onsuccess = e => {
            const db = e.target.result;
            db.close();
            caches.open(userCacheName).then(cache => {
                cache.addAll(assets).then(result => {
                    resolve();
                });
            })
        };
        openRequest.onerror = e => {
            resolve();
        };
    }));
});

self.addEventListener('fetch', e => {
    var request = e.request;
    if (request.method === 'GET') {
        if (request.mode === 'navigate') {
            e.respondWith(
                new Promise((resolve, reject) => {
                    caches.open(userCacheName).then(cache => {
                        cache.match(request).then(cachedResponse => {
                            if (cachedResponse)
                                resolve(cachedResponse);
                            else {
                                fetch(request).then(response => {
                                    resolve(response);
                                }).catch(error => {
                                    cache.match(resolveClientUrl('~/pages/offline')).then(offlineResponse => {
                                        if (offlineResponse)
                                            resolve(offlineResponse);
                                        else
                                            reject(error);
                                    });
                                });
                            }
                        });
                    });
                })
            );
        }
        else if (request.url.match(/\.(woff2|js|css)(\?|$)/)) {
            e.respondWith(
                new Promise((resolve, reject) => {
                    caches.open(staticCacheName).then(cache => {
                        cache.match(request).then(cachedResponse => {
                            if (cachedResponse)
                                resolve(cachedResponse);
                            else
                                fetch(request).then(response => {
                                    if (response.status === 200)
                                        cache.delete(request, { ignoreSearch: true }).then(wasDeleted => {
                                            cache.put(request, response.clone()).then(result => {
                                                resolve(response);
                                            });
                                        });

                                    else
                                        resolve(response);
                                }).catch(error => {
                                    reject(error);
                                });
                        });
                    });
                })
            );
        }
        else if (request.url.match((/\/blob(.ashx)?\?/))) {
            e.respondWith(
                new Promise((resolve, reject) => {
                    const openRequest = indexedDB.open("offline");
                    openRequest.onsuccess = e => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains('blob')) {
                            resolve(fetch(request));
                            db.close();
                        }
                        else {
                            const requestUrl = new URL(request.url);
                            const getRequest = db.transaction('blob').objectStore('blob').get(requestUrl.pathname + requestUrl.search.replace(/&t=.+?(&|$)/, ''));
                            getRequest.onsuccess = e => {
                                var blobInfo = e.target.result;
                                if (blobInfo)
                                    resolve(new Response(new Blob([blobInfo.data.data], { type: blobInfo.data.type })));
                                else
                                    resolve(fetch(request));
                                db.close();
                            };
                            getRequest.onerror = e => {
                                resolve(fetch(request));
                                db.close();
                            }
                        }
                    };
                    openRequest.onerror = e => {
                        resolve(fetch(request));
                    };
                })
            );
        }
    }
});
