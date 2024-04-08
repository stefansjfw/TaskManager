/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Restful.js - RESTful Level 3 Client API
* Copyright 2022-2024 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/

(function () {
    var _app = typeof $app == "undefined" ? null : $app,
        _window = window,
        config = {},
        cache = {},
        serverUrl = '',
        baseUrl,
        _restful;
    if (!_app)
        _window.$app = _app = {};
    _restful = _app.restful;
    if (_restful && !_restful._unresolved)
        return;
    _restful = _app.restful = function (options) {
        if (!options)
            options = { url: null, method: 'GET', body: null };
        var optionsConfig = options.config;
        config = optionsConfig || config;
        if (optionsConfig) {
            baseUrl = optionsConfig.baseUrl || baseUrl;
            if (Object.keys(options).length === 1)
                return;
        }
        if (!baseUrl) {
            baseUrl = typeof __baseUrl == 'undefined' ? null : __baseUrl;
            if (!baseUrl) {
                var allScripts = document.getElementsByTagName('script');
                for (var i = 0; i < allScripts.length; i++) {
                    var script = allScripts[i];
                    var me = (script.getAttribute('src') || '').match(/^(.+?)(\/v\d\/js|\/js\/sys)\/restful.*?\.js/);
                    if (me) {
                        baseUrl = me[1];
                        var serverInfo = baseUrl.match(/^(\w+\:\/\/(.+?))\//);
                        serverUrl = serverInfo ? serverInfo[1] : baseUrl;
                        break;
                    }
                }
            }
        }
        var token = options.token || (options.token !== false && config.token ? (typeof config.token == 'function' ? config.token() : config.token) : null),
            accessToken = typeof token == 'string' ? token : token && typeof token == 'object' ? token.access_token : null;
        if (!accessToken && _app.AccountManager) {
            token = _app.AccountManager.current();
            if (token)
                accessToken = token.access_token;

        }
        // ****************************************************************************
        // debug only - simulates 401 http response that will require the token refresh
        // ****************************************************************************
        //var dummy = _window.dummy;
        //if (dummy == null)
        //    dummy = _window.dummy = 0;
        //if (accessToken != null && dummy % 2 == 0)
        //    accessToken += 'xyz';
        //_window.dummy++;
        // ****************************************************************************
        // end debug
        // ****************************************************************************

        var context = options.context;
        if (context) {
            if (context._links)
                options.url = context._links.self || options.url;
            delete options.context;
        }

        if (options.url && options.url.href) {
            options.method = options.url.method;
            options.url = options.url.href;
        }

        var url = options.url || (baseUrl ? '~/v2' : '/v2'),
            requestBaseUrl = options.baseUrl || baseUrl;

        if (requestBaseUrl) {
            if (!requestBaseUrl.match(/\/$/))
                requestBaseUrl += '/';
            if (url.match(/^~\//))
                url = requestBaseUrl + url.substring(2)
            else if (!url.match(/^(http|\/)/))
                url = requestBaseUrl + url;
            else if (url.match(/^\//))
                url = (options.baseUrl || serverUrl) + url;
        }

        var promise = new Promise((resolve, reject) => {
            var myHeaders = new Headers(),
                method = options.method || 'GET',
                hypermedia = options.hypermedia,
                body = options.body,
                bodyIsFormData = body && body instanceof FormData,
                schema;

            if (typeof hypermedia == 'string' && hypermedia.length) {
                var m = hypermedia.match(/^(.+?)(\s*(>>)\s*(.*))?$/);
                if (m)
                    hypermedia = { name: m[1], transition: !!m[3], next: m[4] };
            }

            if (accessToken)
                myHeaders.append('Authorization', 'Bearer ' + accessToken);
            myHeaders.append("Accept", options.accept || "application/json");
            if (method !== 'GET' && !bodyIsFormData)
                myHeaders.append("Content-Type", options.contentType || "application/json");
            if (options.headers)
                for (var name in options.headers)
                    myHeaders.append(name, options.headers[name]);
            if (options.schema)
                schema = 'true';
            if (options.schemaOnly)
                schema = 'only';
            if (schema)
                myHeaders.append('X-Restful-Schema', schema);
            if (hypermedia === false)
                myHeaders.append('X-Restful-Hypermedia', 'false');

            var queryParams = options.query,
                etag = options.etag,
                blobs,
                bodyLinks;

            if (queryParams) {
                var theUrl = url.match(/^http/i) ? new URL(url) : new URL(url, location.origin);
                if (!hypermedia)
                    for (var paramName in queryParams) {
                        var paramValue = queryParams[paramName];
                        if (paramName === 'fields' && typeof paramValue == 'object')
                            paramValue = JSON.stringify(paramValue).replace(/\:null/g, '').replace(/\"/g, '');
                        theUrl.searchParams.set(paramName, paramValue);
                    }
                url = theUrl.toString();
            }

            if (body && typeof body == 'object' && !bodyIsFormData) {
                if (etag === true) {
                    bodyLinks = body._links;
                    etag = bodyLinks && bodyLinks.self && bodyLinks.self.etag;
                }
                for (var fieldName in body) {
                    var fieldValue = body[fieldName];
                    if (fieldValue instanceof Blob) {
                        if (!blobs)
                            blobs = [];
                        blobs.push({ f: fieldName, v: fieldValue });
                    }
                }
                if (blobs) {
                    blobs.forEach(b => delete body[b.f]);
                    myHeaders.delete('Content-Type');
                }
                body = JSON.stringify(body);
            }

            if (typeof etag == 'string')
                myHeaders.append('If-Match', etag);

            if (blobs) {
                var formdata = new FormData();
                //formdata.set('', body);
                formdata.set('', new Blob([body], { type: 'application/json' }), '');
                blobs.forEach(b =>
                    formdata.set(b.f, b.v, b.v.name || '')
                );
                body = formdata;
            }

            var requestOptions = {
                method: method,
                headers: myHeaders,
                body: method === 'GET' ? null : body,
                redirect: 'follow'
            };

            var responseStatus,
                contentType,
                contentDisposition,
                etag,
                isTextResponse,
                isRawResponse = options.dataType === 'response',
                isCachedResponse;

            function tryAfterTokenRefresh(token) {
                options.token = token;
                _restful(options)
                    .then(result => {
                        if (resolve)
                            resolve(result);
                    })
                    .catch(restfulException);
            }

            function restfulException(error) {
                if (reject)
                    reject(error.error || error);
            }

            function cacheResult(result) {
                if (method === 'GET') {
                    if (options.cache && !(url in cache)) {
                        cache[url] = {
                            result, date: new Date().getTime(), responseStatus, contentType, contentDisposition, etag, isTextResponse, isRawResponse
                        };
                        cache._changed = true;
                    }
                }
                else if (cache._changed) {
                    var cachedResourceUrl = url.match(/^http/i) ? new URL(url) : new URL(url, location.origin);
                    cachedResourceUrl = new URL(cachedResourceUrl.pathname, cachedResourceUrl.origin);
                    var cacheTrimDepth = options.cacheTrimDepth || 2;
                    while (!cachedResourceUrl.pathname.match(/\/v2$/)) {
                        var resourceToDelete = cachedResourceUrl.href;
                        for (var cacheKey in cache) {
                            if (cacheKey === resourceToDelete || cacheKey.startsWith(resourceToDelete + '?') || cacheKey.startsWith(resourceToDelete + '/'))
                                delete cache[cacheKey];
                        }
                        if (!--cacheTrimDepth)
                            break;
                        var lastSlashIndex = cachedResourceUrl.pathname.lastIndexOf('/');
                        if (lastSlashIndex === -1)
                            break;
                        cachedResourceUrl = new URL(cachedResourceUrl.pathname.substring(0, lastSlashIndex), cachedResourceUrl.origin);
                    }
                }
            }

            function fetchResult() {
                var cacheOption = options.cache,
                    cacheEntry = cacheOption && cache[url];
                if (cacheEntry) {
                    var cacheDuration = typeof cacheOption == 'number' ? cacheOption : 600;
                    if (new Date().getTime() - cacheEntry.date > cacheDuration * 1000)
                        delete cache[url];
                    else {
                        isCachedResponse = true;
                        responseStatus = cacheEntry.responseStatus;
                        contentType = cacheEntry.contentType;
                        contentDisposition = contentDisposition;
                        etag = cacheEntry.etag;
                        isTextResponse = cacheEntry.isTextResponse;
                        isRawResponse = cacheEntry.isRawResponse;
                        return Promise.resolve(cacheEntry.result);
                    }
                }
                return fetch(url, requestOptions);
            }

            fetchResult()
                .then(function (response) {
                    if (isCachedResponse)
                        return response;
                    responseStatus = response.status;
                    contentType = response.headers.get("Content-Type") || '';
                    contentDisposition = response.headers.get("Content-Disposition");
                    etag = response.headers.get("ETag");
                    isTextResponse = !isRawResponse && responseStatus !== 401 && contentType.match(/^(application\/(json|x-yaml|xml)|text\/(yaml|x-yaml|xml))/) != null;
                    return isRawResponse ? response : isTextResponse ? response.text() : response.arrayBuffer();
                })
                .then(result => {
                    if (responseStatus === 401) {
                        if (token && token.refresh_token) {
                            if (_app.refreshUserToken) {
                                _app.refreshUserToken(token, () => {
                                    tryAfterTokenRefresh(_app.AccountManager.current());
                                });
                            }
                            else {
                                _restful({
                                    url: '/oauth2/v2/token',
                                    method: 'POST',
                                    body: {
                                        grant_type: 'refresh_token',
                                        client_id: config.clientId,
                                        refresh_token: token.refresh_token
                                    },
                                    token: false
                                })
                                    .then(result => {
                                        if (typeof config.token == 'function') {
                                            var newToken = config.token()
                                            if (typeof newToken == 'object') {
                                                for (var propName in result)
                                                    newToken[propName] = result[propName];
                                            }
                                            config.token(newToken);
                                        }
                                        options.token = result;
                                        tryAfterTokenRefresh(result);
                                    })
                                    .catch(restfulException);
                            }
                        }
                        else
                            restfulException(createError(401, 'Unauthorized', 'access_denied', 'Invalid access token or API key is specified.'));
                    }
                    else if (resolve) {
                        cacheResult(result);
                        if (isRawResponse)
                            resolve(result);
                        else if (isTextResponse && contentType.match(/^application\/json/)) {
                            if (result == null || !result.length)
                                result = "{}";
                            result = JSON.parse(result);
                            if (result && result.error) {
                                result.error._schema = result._schema;
                                restfulException(result.error);
                            }
                            else {
                                if (etag && result._links) {
                                    var self = getSelfLink(result);
                                    if (self)
                                        self.etag = etag;
                                }
                                var hypermediaName = hypermedia && hypermedia.name
                                if (hypermediaName) {
                                    var resultLinks = result._links,
                                        transition = hypermedia.transition,
                                        hypermediaIsDataPath = hypermediaName.match(/^\./);
                                    if (hypermediaIsDataPath) {
                                        var resultObj = result;
                                        hypermediaName.substring(1).split(/\./g).forEach(key => {
                                            if (resultObj != null && key.length)
                                                resultObj = resultObj[key];
                                        });
                                        if (transition)
                                            result = typeof resultObj == 'string' ? { href: resultObj } : resultObj;
                                        else {
                                            resolve(resultObj);
                                            return;
                                        }
                                    }
                                    else if (resultLinks) {
                                        var tentativeResult = resultLinks[hypermediaName];
                                        if (tentativeResult)
                                            result = tentativeResult;
                                        else if (resultLinks['restful.js']) {
                                            tentativeResult = result[hypermediaName];
                                            if (tentativeResult)
                                                result = getSelfLink(tentativeResult, transition);
                                        }
                                        else
                                            result = null;
                                        if (!result && transition) {
                                            var selfLink = getSelfLink(resultLinks, transition);
                                            result = { href: urlToPath(selfLink ? selfLink.href : url) + '/' + hypermediaName };
                                        }
                                    }
                                    else
                                        result = null;
                                    if (result == null || transition && !result.href)
                                        restfulException(createError(400, 'Bad Request', 'invalid_hypermedia', "Hypermedia '" + hypermediaName + "' not found in " + method + " " + url + ' response.'));
                                    else if (transition) {
                                        var restore = options.restore;
                                        if (restore) {
                                            for (var key in restore)
                                                if (restore[key] == null)
                                                    delete options[key];
                                                else
                                                    options[key] = restore[key];
                                            options.restore = restore = null;
                                        }
                                        var hre = new RegExp(RegExp('^' + hypermediaName + '\\s*>>'));
                                        for (var key in options)
                                            if (key.match(hre)) {
                                                options.restore = restore = {};
                                                ['body', 'query', 'headers', 'files', 'etag', 'schema', 'schemaOnly', 'accept', 'contentType'].forEach(key => {
                                                    restore[key] = options[key];
                                                    delete options[key];
                                                });
                                                var hypermediaData = options[key];
                                                if (hypermediaData)
                                                    for (var key in hypermediaData)
                                                        options[key] = hypermediaData[key];
                                                break;
                                            }
                                        options.url = result;
                                        options.hypermedia = hypermedia.next;
                                        _restful(options)
                                            .then(result => {
                                                resolve(result);
                                            })
                                            .catch(restfulException);
                                        return;
                                    }
                                }
                                if (hypermedia === true)
                                    result = result._links || {};
                                resolve(result || {});
                            }
                        }
                        else {
                            if (!isTextResponse && !isCachedResponse) {
                                var filename = 'file.' + (contentType.split(';')[0] || '/dat').split(/\//)[1];
                                if (contentDisposition) {
                                    var fn = contentDisposition.match(/filename=(.+?)(;|$)/);
                                    if (fn)
                                        filename = fn[1];

                                }
                                result = new Blob([result], { type: contentType });
                                result.name = filename;
                            }
                            resolve(result);
                        }
                    }
                })
                .catch(error => {
                    restfulException(createError(400, 'Bad Request', 'error', error));
                });
        });
        return promise;
    };

    function urlToPath(url) {
        var m = url.match(/^(.+?)(\?|\#)/)
        return m ? m[1] : url;
    }

    function getSelfLink(obj, transition) {
        var links = obj._links || obj,
            selfLink;
        if (links) {
            if (transition)
                selfLink = links.transit;
            if (!selfLink)
                selfLink = links.self;
        }
        return selfLink;
    }

    function createError(httpCode, httpMessage, reason, error) {
        return {
            error: {
                errors: [
                    {
                        id: "00000000-0000-0000-0000-000000000001",
                        reason: reason,
                        message: error.message || error
                    }],
                code: httpCode,
                message: httpMessage
            }
        }
    }
})();