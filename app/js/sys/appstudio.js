/*eslint eqeqeq: ["error", "smart"]*/
/*!
* App Studio Core shared by app and the studio
* Copyright 2017-2024 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/
(function () {

    var _app = $app,
        _touch = _app.touch,
        _frame,
        _selectionMarker,
        $body = $('body'),
        isStudio,
        isInspecting,
        originalState,
        scrollDelta, // designer variable indicating the amount of scrolling for the inspected page
        virtualDeviceList = [
            { name: 'Responsive', width: 'auto', height: 'auto' },
            { name: 'iPhone SE ', width: 375, height: 667 },
            { name: 'iPhone XR', width: 414, height: 896 },
            { name: 'iPhone 12 Pro', width: 390, height: 844 },
            { name: 'Pixel 5', width: 393, height: 851 },
            { name: 'Pixel 7', width: 412, height: 783 },
            { name: 'Pixel 7 Pro', width: 412, height: 892 },
            { name: 'Pixel 8 Pro', width: 448, height: 998 },
            { name: 'Samsung Galaxy S8+', width: 360, height: 740 },
            { name: 'Samsung Galaxy S20 Ultra', width: 412, height: 915 },
            { name: 'iPad Air', width: 820, height: 1180 },
            { name: 'iPad Mini', width: 768, height: 1024 },
            { name: 'iPad Pro', width: 1024, height: 1366 },
            { name: 'Surface Pro 7', width: 912, height: 1368 },
            { name: 'Surface Duo', width: 540, height: 720 },
            { name: 'Galaxy Fold', width: 280, height: 653 },
            { name: 'Samsung Galaxy A51/71', width: 412, height: 914 }
        ],
        _device,
        appScreen = {},
        _screen = _touch.screen(),
        _startOptions,
        studioManifest,
        itemStudioDesign = { studio: true, inspect: true, text: 'Design', desc: 'App Studio', icon: 'material-icon-build', shortcut: 'Ctrl+Shift+D', toolbar: false, sidebar: false, callback: () => appStudioStart({ inspect: true }) },
        itemStudioExit = { studio: true, inspect: true, text: 'Exit to App', desc: 'App Studio', icon: 'material-icon-exit-to-app', shortcut: 'Ctrl+Shift+D', toolbar: false, sidebar: false, callback: exitVirtualScreen },
        // remove after full implementaiton
        v9Feature = {
            apps: {
                text: 'Apps Directory',
                url: 'id.usg03cqgj9ij'
            },
            settings: {
                text: 'Project Settings editor',
                url: 'id.ryz0l8ywajq0',
            },
            models: {
                text: 'Model Builder',
                url: 'id.tnjobt7r90rf',
            },
            pages: {
                text: 'Navigation Menu editor',
                url: 'id.tnjobt7r90rf',
            },
            restful: {
                text: 'RESTful API Mode',
                url: 'id.ko25gif05jss',
            },
            widgets: {
                text: 'Widgets menu',
                url: 'id.tbrssg6y5jeb',
            },
            explore: {
                text: 'Project Explorer',
                url: 'id.6vqwqh1rfqxa'
            },
            publish: {
                text: 'Publishing',
                url: 'id.5f7dfyfh4a7x'
            }
        },
        // html utilities
        htmlUtilities = _app.html,
        htmlTag = htmlUtilities.tag,
        div = htmlUtilities.div,
        span = htmlUtilities.span,
        $htmlTag = htmlUtilities.$tag,
        $p = htmlUtilities.$p,
        $div = htmlUtilities.$div,
        $span = htmlUtilities.$span,
        $a = htmlUtilities.$a,
        $i = htmlUtilities.$i,
        $li = htmlUtilities.$li,
        $ul = htmlUtilities.$ul;


    function checkPendingStudioTrigger() {
        if (_touch.busy())
            setTimeout(checkPendingStudioTrigger, 100);
        else {
            var studioState = _app.studio.state(),
                studioTrigger = studioState.trigger;
            if (studioTrigger) {
                if (studioTrigger === 'reload')
                    _app.studio.state(null);
                else if (isStudio)
                    appShield('show');
                else
                    appStudioStart();
            }
        }
    }

    _app.studio = {
        _config: {},
        start: function () {
            if (__settings.appStudio)
                _app.id = __settings.appStudio.self.id;
            if (isStudio) {
                postMessageToApp({ method: 'enableVirtualDevice' })
            }
            else {
                ensureStudioControls(true);
            }
            checkPendingStudioTrigger();
        },
        define: function (hierarchy, metadata, definition) {
            var config = _app.studio._config[hierarchy];
            if (!config)
                config = _app.studio._config[hierarchy] = {};
            if (arguments.length === 2)
                return config[metadata];
            switch (metadata) {
                case 'node':
                case 'inspector':
                    if (!config[metadata])
                        config[metadata] = [];
                    if (Array.isArray(definition))
                        config[metadata] = config[metadata].concat(definition);
                    else
                        config[metadata].push(definition);
                    break;
                default:
                    if (!config[metadata])
                        config[metadata] = {};
                    if (typeof definition == 'object')
                        for (var propName in definition)
                            config[metadata][propName] = definition;
                    else
                        config[metadata] = definition;
                    break;
            }
            return config;
        },
        toSelector: function (elem, type) {
            var selector,
                tempSelector = { type: type.type },
                propertyMap = type.collect,
                propertyList = ['type'], p;
            for (p in propertyMap)
                propertyList.push(p);
            // locate values of declarative properties
            for (p in propertyMap) {
                var propDef = propertyMap[p];
                if (typeof propDef == 'string')
                    if (propDef.match(/^\$/))
                        tempSelector[p] = propDef;
                    else {
                        propDef = propDef.split(/\//);
                        var el = elem;
                        if (propDef.length === 2) {
                            el = elem.closest(propDef[0]);
                            tempSelector[p] = propDef[1].match(/^@/) ? el.attr(propDef[1].substring(1)) : el.find(propDef[1]).text();
                        }
                        else if (propDef[0].match(/^@/))
                            tempSelector[p] = el.attr(propDef[0].substring(1));
                        else
                            tempSelector[p] = el.closest(propDef[0]).text();
                    }
            }
            // assing standard properties
            if ('dataView' in tempSelector) {
                /* .ui-page/@id */
                var dataView = tempSelector['dataView'];
                if (dataView === '$dataView') {
                    var dataViewId = elem.closest('.app-echo').attr('data-for');
                    if (!dataViewId)
                        dataViewId = elem.closest('.ui-page').attr('id');
                    if (dataViewId === 'Main')
                        dataViewId = elem.closest('.app-echo').attr('data-for');
                    dataView = _app.find(dataViewId);
                    if (!(dataView && dataView._controller && dataView._viewId)) {
                        dataViewId = null;
                        dataView = null;
                    }
                    tempSelector['dataView'] = dataViewId;
                }
                else
                    dataView = _app.find(tempSelector.dataView);
                if (dataView) {
                    propertyList.splice(propertyList.indexOf('dataView') + 1, 0, 'controller', 'view');
                    tempSelector['controller'] = dataView._controller;
                    tempSelector['view'] = dataView._viewId;
                    var pageInfo = _touch.pageInfo(dataView);
                    if (pageInfo && pageInfo.home || elem.closest('#Main.ui-page').length) {
                        propertyList.splice(propertyList.indexOf('dataView'), 0, 'page');
                        var pagePath = location.pathname.split(/\//g);
                        tempSelector['page'] = pagePath[pagePath.length - 1];
                    }
                }
            }
            if ('page' in tempSelector && tempSelector['page'] === '$page') {
                pagePath = location.pathname.split(/\//g);
                tempSelector['page'] = pagePath[pagePath.length - 1];
            }
            // calculate properties of selector
            for (p in propertyMap) {
                propDef = propertyMap[p];
                if (typeof propDef == 'function')
                    tempSelector[p] = propDef.call(tempSelector, elem);
            }

            // prepare selector
            selector = {};
            if (type.property) {
                tempSelector['property'] = type.property;
                propertyList.push('property');
            }
            // copy collected properties
            propertyList.forEach(function (p) {
                selector[p] = tempSelector[p];
            });
            return selector;
        },
        config: function (metadata) {
            var result,
                config,
                name;
            for (name in this._config) {
                config = this._config[name];
                if (config.when && config.when()) {
                    result = config[metadata];
                    break;
                }
            }
            return result;
        },
        inspect: function (x, y) {
            _frame.css('left', -10000);
            var elem = $(document.elementFromPoint(x, y)),
                type, selector, navigate,
                inspectorConfig = _app.studio.config('inspector');
            if (inspectorConfig) {
                _frame.css('left', '');
                inspectorConfig.every(function (t) {
                    try {
                        var el = elem.closest(t.test);
                        if (el.length && (!t.skip || !elem.closest(t.skip).length)) {
                            elem = el;
                            type = t;
                            navigate = t.navigate;
                            // create a selector
                            selector = _app.studio.toSelector(elem, t);
                            // validate selector
                            if (t.require)
                                for (var p in t.require) {
                                    var def = t.require[p];
                                    if ((typeof def == 'function' && def.call(selector, elem) || def) && selector[p] == null) {
                                        type = null;
                                        selector = null;
                                        navigate = null;
                                        break;
                                    }
                                }
                        }
                    }
                    catch (ex) {
                        console.log(`${ex.message} in "${t.test}"`);
                    }
                    return !type;
                });

                this.explore({ elem, selector, navigate });
            }
            else
                _touch.notify('Inspector configuration is not available.');
        },
        explore: function (options) {
            var elem = options.elem,
                bounds = elem[0].getBoundingClientRect();
            postMessageToStudio({
                method: 'explore',
                selector: options.selector,
                bounds: {
                    left: bounds.left,
                    top: bounds.top,
                    width: bounds.width,
                    height: bounds.height
                },
                navigate: _app.eval(options.navigate, options.selector)
            });
        },
        menu: function () {
            return [{ "title": "Home", "url": "/pages/home", "description": "Application home page", "selected": true, "cssClass": "Wide" }];
        },
        getScript: function (url, options) {
            if (typeof url != 'string') {
                options = url;
                url = options.url;
            }
            if (!options)
                options = {};

            if (url.match(/^~\//))
                url = _touch.studio() + '/' + url.substring(2);

            if (studioManifest) {
                options.manifest = studioManifest;
                return _app.getScript(url, options);
            }
            else
                return new Promise((resolve, reject) => {
                    fetch(_touch.studio() + '/manifest.json', { cache: 'no-store' })
                        .then(response => response.text())
                        .then(manifest => {
                            studioManifest = JSON.parse(manifest);
                            var studioUrl = _touch.studio();
                            studioManifest.offline_resources.forEach(r => {
                                r.src = studioUrl + '/' + r.src;
                            });
                            _app.studio.getScript(url, options)
                                .then(() => {
                                    resolve();
                                })
                                .catch(ex => {
                                    reject(ex);
                                })
                        })
                        .catch(ex => {
                            reject(ex);
                        })
                });
        }
    };

    function postMessageToApp(data) {
        parent.postMessage(data, location.href);
    }

    function postMessageToStudio(data) {
        if (_frame)
            _frame[0].contentWindow.postMessage(data, location.href);
    }

    function appStudioStart(options) {
        if (_touch.busy())
            return;
        if (!options)
            options = { inspect: false };

        if (isStudio) {
            $('.studio-btn-inspect').attr({
                'data-studio-action': 'inspect-end',
                'data-title': 'End Inspection'
            }).find('i').text('arrow_selector_tool');
            $body.addClass('studio-inspecting');
            isInspecting = true;
        }
        else {

            if (options.event)
                _startOptions = options;

            // start the "design" mode
            $(document.activeElement).trigger('blur');
            _touch.tooltip(false);
            _touch.notify(false);
            try {
                if (window.location.hash)
                    originalState = window.history.state;
            } catch (ex) {
                // do nothing
            }
            _touch.busy(true);
            //if (_frame)
            //    _frame.remove();
            if (options.inspect)
                $('.studio-btn-inspect i').text('arrow_selector_tool'); // instantly change the icon of the "inspect" button
            _frame = $(`<iframe class="studio-frame" src="${__baseUrl}_appstudio?_showNavigation=false&inspect=${options.inspect ? 'true' : 'false'}"></iframe>`).css('left', -10000).appendTo($body).trigger('focus');
        }
    }

    function appStudioExit() {
        if (!isStudio || _touch.busy() || appShield(':active'))
            return;
        // exit the "design" mode
        var historyDepth = $.touch.navigate.history.activeIndex + 1;
        if (historyDepth > 2) {
            _touch.whenPageShown(appStudioExit);
            window.history.go(2 - historyDepth);
        }
        else
            postMessageToApp({ method: 'hide' });
    }

    function appScreenDeviceMatch(device) {
        return device.name === 'Responsive' && (appScreen.width === _screen.physicalWidth - 112 && appScreen.height === _screen.physicalHeight - 112) ||
            appScreen.width === device.width && appScreen.height === device.height ||
            appScreen.width === device.height && appScreen.height === device.width;
    }

    function exitVirtualScreen() {
        $('.app-bar-notify').removeData('notify');
        if (isStudio) {
            if (appShield(':active'))
                notifyApplicationChanged();
            else {
                appStudioExit();
                postMessageToApp({ method: 'exit' });
            }
        }
        else {
            if (_screen.isVirtual) {
                var lastDevice = _touch.device();
                if (lastDevice)
                    _app.userVar('lastVirtualDevice', lastDevice);
                _app.storage.set(window.location.host + '_VirtualDeviceHint', 'off');
                _app.userVar('studioOnStart?', false);
                changeDevice({ name: "Responsive" });
                _touch.screen('resize');
                appStudioHint();
            }
            hideToolbarsIfStudioIsHidden();
        }
    }

    function appStudioHint(started) {
        if (started) {
            if (_app.storage.get(window.location.host + '_VirtualDeviceHint') !== 'off')
                setTimeout(() => {
                    _touch.notify({ text: 'App Studio mode was started automatically. Use the studio controls to modify this application. You can exit to the app at any time.', duration: 'long', buttonText: 'Disable', buttonEvent: 'studioonstartdisabled.app' });
                }, 1000);
        }
        else
            _touch.notify({ text: '<div>Press Ctrl+Shift+D or chose the "Design" option\nin the "More" menu to start the App Studio.</div>', html: true, duration: 'long', buttonText: 'Design', buttonEvent: 'studioactioninspectstart.app' });
    }

    function updateScrollDelta() {
        var inspectedScrollable = $(parent.window.document).find('.ui-page-active .app-wrapper');
        scrollDelta = inspectedScrollable[0].scrollHeight - inspectedScrollable.height();
    }

    function keyDownInStudio(e) {
        var keyCode = e.keyCode || e.which;
        if (!e.isDefaultPrevented() && keyCode === 27 && $('.ui-page-active#studio').length) {
            if (_selectionMarker.is(':visible'))
                hideSelectionMarker();
            else
                setTimeout(appStudioExit);
            return false;
        }
    }

    function getStudioTools() {
        return Promise.all([
            _app.studio.getScript('~/js/studio/tools.js'),
            _app.studio.getScript('~/css/appstudio-icons.css')
        ]).catch(ex => {
            _touch.notify(studioErrorMessage(ex));
            throw ex;
        });
    }

    function hideSelectionMarker() {
        if (_selectionMarker) {
            _selectionMarker.hide();
            $('.studio-inspection-result').hide();
        }
    }

    $(document).on('vclick', '.studio #studio .ui-content', function (e) {
        _touch.notify(false);
        if (isInspecting)
            postMessageToApp({ method: 'inspect', at: _touch.lastTouch() });
        else
            appStudioExit();
    }).one('start.app', function (e) {
        if ($('body.studio').length) {
            // loaded from AppStudio app
            isStudio = true;
            isInspecting = _touch.startUrl().match(/inspect=true/);
            _selectionMarker = $span('studio-selector').appendTo('#studio').hide();
            postMessageToApp({ method: 'started' });
            if (isInspecting) {
                $body.addClass('studio-inspecting');
                _touch.notify({ text: 'Click or tap anywhere in the app to inspect. Press \'Esc\' to end the inspection mode.', duration: 'long' });
            }
            $(document).on('keydown', keyDownInStudio);
            _app.studio.start();
        }
    }).one('pagereadycomplete.app', function (e) {
        if (isStudio) {
            ensureStudioControls(!isStudio);
            // create the scrollable element of the studio
            var inspectedScrollable = $(parent.window.document).find('.ui-page-active .app-wrapper'),
                activePageScrollTop = inspectedScrollable.scrollTop();
            $('.ui-page-active .app-vscrollbar').css('display', 'none');
            updateScrollDelta();
            var scrollable = $('.ui-page-active .app-wrapper');
            $div('studio-scroller').css({ 'height': scrollDelta + scrollable.height() }).appendTo(scrollable);
            scrollable.scrollTop(activePageScrollTop).data('scrollTop', activePageScrollTop).on('scroll', function () {
                var newScrollTop = scrollable.scrollTop();
                if (newScrollTop !== scrollable.data('scrollTop')) {
                    hideSelectionMarker();
                    inspectedScrollable.scrollTop(newScrollTop);
                    scrollable.data('scrollTop', newScrollTop);
                }
            });
        }
    }).on('pagereadycomplete.app', e => {
        if (isStudio && !location.hash && appShield(':active')) {
            notifyApplicationChanged();
        }
    }).on('resized.app', function (e) {
        if (isStudio) {
            updateScrollDelta();
        }
        updateVirtualDevice();
    }).on('context.app', function (e) {
        //e.context.push({}, e.context.isSideBar ?
        //    (_screen.isVirtual ? itemStudioFullscreenInSideBar : itemStudioDesignInSideBar) :
        //    (isDesigner ? itemStudioExitInContext : _screen.isVirtual ? itemStudioFullscreenInContext : itemStudioDesignInContext),
        //    {});
        if (isStudio) {
            if (!location.hash) {
                var inspectionMode = isStudio && isInspecting;
                e.context.push(
                    //{
                    //    studio: true,
                    //    static: true,
                    //    text: 'Studio'
                    //},
                    {
                        studio: true,
                        text: 'Apps',
                        icon: 'material-icon-apps',
                        context: { action: 'apps' },
                        callback: studioActionHandler
                    },
                    {
                        studio: true
                    },
                    {
                        studio: true,
                        text: inspectionMode ? 'End Inspection' : 'Inspect',
                        icon: inspectionMode ? 'material-icon-arrow-selector-tool' : 'material-icon-point-scan',
                        context: { action: inspectionMode ? 'inspect-end' : 'inspect-start' },
                        callback: studioActionHandler
                    },
                    {
                        studio: true,
                        text: 'Settings',
                        icon: 'material-icon-settings',
                        context: { action: 'settings' },
                        callback: studioActionHandler
                    },
                    {
                        studio: true,
                        text: 'Models',
                        icon: 'material-icon-account-tree',
                        context: { action: 'models' },
                        callback: studioActionHandler
                    },
                    {
                        studio: true,
                        text: 'Pages',
                        icon: 'material-icon-menu-book',
                        context: { action: 'pages' },
                        callback: studioActionHandler
                    },
                    { studio: true },
                    {
                        studio: true,
                        text: 'Develop',
                        icon: 'material-icon-webhook',
                        context: { action: 'develop' },
                        callback: studioActionHandler
                    },
                    {
                        studio: true,
                        text: 'Show Source Code',
                        icon: 'material-icon-folder-open',
                        context: { action: 'open' },
                        callback: studioActionHandler
                    },
                    {
                        studio: true,
                        text: 'Sync Design',
                        icon: 'material-icon-sync',
                        context: { action: 'sync' },
                        callback: studioActionHandler
                    },
                    {
                        studio: true,
                        text: 'Publish',
                        icon: 'material-icon-publish',
                        context: { action: 'publish' },
                        callback: studioActionHandler
                    },
                    { studio: true },
                    {
                        studio: true,
                        text: 'Design',
                        icon: 'material-icon-build',
                        context: { action: 'explore' },
                        callback: studioActionHandler
                    }
                );
                e.context.push(

                    {
                        studio: true,
                        text: 'Form Template',
                        context: { action: 'form-template' },
                        icon: 'material-icon-screenshot',
                        callback: studioActionHandler
                    },
                    { studio: true }
                );
                if (!$('[data-studio-action="rotate"]').is('.studio-btn-hidden'))
                    e.context.push(
                        {
                            studio: true,
                            text: 'Rotate',
                            icon: 'material-icon-screen-rotation-alt',
                            context: { action: 'rotate' },
                            callback: studioActionHandler
                        });
                e.context.push(itemStudioExit);
            }
        }
        else {
            if (!_screen.isVirtual)
                e.context.push({}, itemStudioDesign);
            //    if (_screen.isVirtual)
            //        e.context.push(itemStudioFullscreen);
        }
    }).on('vclick', '.studio-app-shield', e => {
        if (!appShield(':log')) {
            executeStudioTrigger();
            return false;
        }
    }).on('execstudiotrigger.app', e => {
        appShield().trigger('vclick');
    }).on('vclick', '[data-studio-action]', e => {
        var target = $(e.target).closest('[data-studio-action]');
        target.addClass('app-active');
        setTimeout(() => {
            target.removeClass('app-active');
        }, 96);
        setTimeout(studioActionHandler, 64, { target, action: target.attr('data-studio-action') });
        return false;
    }).on('studioactioninspectend.app', e => {
        appStudioExit();
        return false;
    }).on('studioactioninspectstart.app', e => {
        appStudioStart({ inspect: true });
        return false;
    }).on('studioactionexit.app', e => {
        exitVirtualScreen();
        return false;
    }).on('studioactionmore.app', e => {
        if (!isStudio) {
            appStudioStart({ event: { type: 'studioactionmore.app' } });
        }
        else {
            _touch.showContextMenu();
            if (!isInspecting)
                $(document).one('panelclosed.app', e => {
                    if (e.canceled)
                        appStudioExit();
                });
        }
        return false;
    }).on('studioactionsettings.app', e => {
        if (!isStudio) {
            appStudioStart({ event: { type: 'studioactionsettings.app' } });
        }
        else {
            //var treeView = e.treeView || {};
            getStudioTools()
                //.then(() =>
                //    _app.studio.tools.settings.run()
                //)
                // **************************************************************************************************
                // TODO: Migrate the code below to the $app.studio.tools.settings.run() implementation
                // **************************************************************************************************
                .then(() => {
                    $app.touch.propGrid('show', {
                        instance: 'studio.settings',
                        text: 'Settings',
                        icon: 'material-icon-settings',
                        nodes: fetchHierarchy(`/v2/studio/hierarchies/settings/definition`),
                        helpUrl: 'https://codeontime.com/roadmap/v9',
                        location: 'left'
                    });
                    notifyIncompleteImplementation('settings');
                })
                .catch(ex => studioError(ex));
        }
        return false;
    }).on('studioactionexplore.app', e => {
        if (!isStudio) {
            appStudioStart({ event: { type: 'studioactionexplore.app' } });
        }
        else {
            getStudioTools()
                //.then(() =>
                //    _app.studio.tools.explore.run()
                //)
                // **************************************************************************************************
                // TODO: Migrate the code below to the $app.studio.tools.explore.run() implementation
                // **************************************************************************************************
                .then(() => {
                    $app.touch.propGrid('show', {
                        instance: 'studio.explore',
                        text: 'Project Explorer',
                        icon: 'material-icon-build',
                        nodes: fetchHierarchy(`/v2/studio/hierarchies/controllers/definition`),
                        helpUrl: 'https://codeontime.com/roadmap/v9',
                        location: 'right'
                    });
                    notifyIncompleteImplementation('explore');
                })
                .catch(ex => studioError(ex));


        }
        return false;
    }).on('studioactionmodels.app', e => {
        if (!isStudio) {
            appStudioStart({ event: { type: 'studioactionmodels.app' } });
        }
        else {
            //var objectType = e?.treeView?.node.type;
            getStudioTools()
                //.then(() =>
                //    _app.studio.tools.models.run()
                //)
                // **************************************************************************************************
                // TODO: Migrate the code below to the $app.studio.tools.models.run() implementation
                // **************************************************************************************************
                .then(() => {
                    $app.touch.propGrid('show', {
                        instance: 'studio.models',
                        text: 'Model Builder',
                        icon: 'material-icon-account-tree',
                        nodes: fetchHierarchy(`/v2/studio/hierarchies/models/definition`),
                        helpUrl: 'https://codeontime.com/roadmap/v9',
                        location: 'left'
                    });
                    notifyIncompleteImplementation('models');
                })
                .catch(ex => studioError(ex));


        }
        return false;
    }).on('studioactionformtemplate.app', e => {
        if (isStudio)
            if (e.notify)
                $app.touch.notify(e.notify);
            else
                postMessageToApp({ method: 'trigger', event: { type: 'studioactionformtemplate.app' } });
        else {
            var dataView = $app.touch.dataView();
            if (dataView && dataView.get_isForm()) {
                var survey = dataView._survey,
                    fileName = dataView._controller,
                    layout = '';
                // produce the HTML definition of the layout
                if (survey && survey.layout) {
                    fileName = fileName.replace(/__search/, '._search');
                    layout += String.format('<!--\r\n\t~/js/surveys/{0}.html\r\n-->\r\n{1}', fileName, survey.layout);
                }
                else {
                    fileName += '.' + dataView._viewId;
                    layout += '\r\n<!--  ' + $app.touch.toWidth(_screen.width) + ' -->\r\n';
                    layout += $app.touch.generateLayout(dataView, _screen.width);
                    layout += '\r\n';
                    layout = String.format('<!--\r\n\t~/views/{0}.html\r\n-->\r\n{1}', fileName, layout.replace(/<span\s+class=\"app-control-inner\">([\s\S]+?)<\/span>/g, '$1').replace(/\n\s*>/g, '>'));
                }
                $app.saveFile(fileName + '.html.txt', layout);
            }
            else {
                postMessageToStudio({ method: 'trigger', event: { type: 'studioactionformtemplate.app', data: { notify: 'The top-level view is not a form.' } } });
            }
        }
        return false;
    }).on('studioonstartdisabled.app', e => {
        exitVirtualScreen();
        return false;
    }).on('studioactiondevice.app', e => {
        if (!isStudio)
            appStudioStart({ event: { type: 'studioactiondevice.app', data: { exitStudio: true } } });
        else {
            var button = $('[data-studio-action="device"]').addClass('app-selected'), // this will result in the correct "left" offset of the menu
                buttonRect = _app.clientRect(button),
                items = [];
            virtualDeviceList.forEach((vd, index) => {
                items.push({
                    text: vd.name,
                    context: {
                        device: vd,
                        exitStudio: e.exitStudio
                    },
                    icon: appScreenDeviceMatch(vd) ? 'check' : null,
                    callback: changeDeviceEx
                });
                if (!index)
                    items.push({ text: 'RESTful API', callback: studioActionHandler, context: { action: 'restful' } }, {});
            })
            _touch.listPopup({ anchor: button, arrow: false, x: buttonRect.left, y: buttonRect.top, items, fullscreen: true });
            if (!isInspecting)
                $(document).one('popupclosed.app', e => {
                    if (e.canceled && !isInspecting)
                        appStudioExit();
                });
        }
        return false;
    }).on('studiofeature.app', e => {
        var feature = v9Feature[v9Feature._last];
        var topic = '';
        if (feature) {
            var url = v9Feature[v9Feature._last].url;
            var slug = feature.url.match(/id\.(\w+)$/);
            if (slug)
                topic = '#' + slug[1];
        }
        url = 'https://codeontime.com/roadmap/v9' + topic;
        window.open(url, '_blank');
        return false;
    }).on('studioactionsync.app', e => {
        if (!isStudio) {
            appStudioStart({ event: { type: 'studioactionsync.app', data: { exitOnCancel: true } } });
        }
        else {
            _app.touch.show({
                text: 'Sync Design',
                text2: 'App Studio',
                topics: [
                    {
                        wrap: true,
                        questions: [
                            {
                                text: false,
                                value: '<b>Integrate changes made by other developers in the project.</b><p></p>',
                                readOnly: true,
                                htmlEncode: false,
                                options: {
                                    textStyle: 'primary'
                                }
                            },
                            {
                                name: 'SchemaChanged',
                                text: false,
                                items: {
                                    style: 'CheckBoxList',
                                    list: [
                                        { value: 'SchemaChanged', text: 'The database schema has changed recently.' }
                                    ]
                                },
                                options: {
                                    mergeWithPrevious: true
                                }
                            }
                        ]
                    }
                ],
                options: {
                    materialIcon: 'sync',
                    modal: {
                        fitContent: true,
                        max: 'xxs',
                        always: true
                    },
                    contentStub: false,
                    discardChangesPrompt: false
                },
                submitText: 'Synchronize'
            })
                .then(result => {
                    appShield('log');
                    getStudioTools()
                        .then(() =>
                            _app.studio.tools.sync.run({ metadata: !!result.SchemaChanged })
                        )
                        .then(sessionMonitor)
                        .catch(studioTriggerError);
                })
                .fail(() => {
                    if (e.exitOnCancel) // this property will be defined only if 'sync' was initiated from the app
                        appStudioExit();
                });
        }
        return false;
    }).on('studioactionrotate.app', e => {
        if (isStudio)
            postMessageToApp({ method: 'trigger', event: { type: 'studioactionrotate.app' } });
        else {
            var device = findVirtualDevice(),
                newWidth,
                newHeight;
            if (_screen.width === device.width) {
                newWidth = device.height;
                newHeight = device.width;
            }
            else {
                newWidth = device.width;
                newHeight = device.height;
            }
            changeDevice({ name: device.name, width: newWidth, height: newHeight });
        }
        return false;
    }).on('vclick', '.studio-skirt, .app-virtual-screen-bar', e => {
        _touch.notify(false);
        if (isStudio)
            hideSelectionMarker();
        return false;
    });

    $(window).on('resize', function () {
        if (isStudio)
            hideSelectionMarker();
    });

    // handle the 'treeview' event of the App Studio hierarchies

    $(document)
        .on('treeview.app', e => {
            if (isStudio) {
                var treeView = e.treeView;
                if (treeView.eventName === 'iterate') {
                    treeView.result = fetchFromProject({ hypermedia: treeView.node.iterate, context: treeView.nodeData })
                        .then(response => {
                            return Promise.resolve(response?.collection || [])
                        });
                }
                if (treeView.eventName === 'navigate') {
                    e.preventDefault();
                    var pathInfo = treeView.path.match(/^(.+?)\:\/\/(.+)$/);
                    if (pathInfo) {
                        _app.userVar('treeview.studio.' + pathInfo[1], treeView.path)
                        _touch.goBack(() => {
                            $(document).trigger(`studioaction${pathInfo[1]}.app`);
                        });
                    }
                }
            }
        })
        .on('propgrid.app', e => {
            if (isStudio) {
                switch (e.propGrid.eventName) {
                    case 'edit':
                        executePropGridEdit(e.propGrid, e.treeView);
                        return false;
                    case 'help':
                        executePropGridHelp(e.propGrid, e.treeView);
                        return false;
                    case 'fetch':
                        e.propGrid.result = Promise.all([
                            fetchObject(e.treeView.node?.type),
                            fetchFromProject({ hypermedia: e.treeView.node?.get, context: e.treeView.nodeData })
                        ]);

                }
            }
        });

    function executePropGridHelp(propGrid, treeView) {
        //window.open(url, 'propgridhelp_' + propGridDef().context.replace(/\W/g, '_'));
        window.open('https://codeontime.com/roadmap/v9?topic=' + encodeURIComponent(propGrid.path));
    }

    function clearDynamicLookupCachesInPropGrid() {
        var dataView = _touch.dataView();
        if (dataView)
            for (var key in dataView._pageSession)
                if (key.match(/(_listOfValues_|_listCache)/))
                    delete dataView._pageSession[key];
    }

    function executePropGridEdit(propGrid, treeView) {
        _touch.notify(false);
        var targetObj = propGrid.context.target;
        if (targetObj?._links) {
            var url = targetObj._links[propGrid.eventName],
                body = propGrid.patch,
                patchMap = body._map;
            delete body._map;
            if (!url && propGrid.eventName === 'edit') {
                url = targetObj._links['replace'];
                if (url) {
                    body = new FormData();
                    body.append(
                        'value',
                        new Blob([JSON.stringify(targetObj)], { type: 'application/json' })
                    );
                }
            }
            if (url)
                studioRestful({
                    url,
                    body
                })
                    .then(result => {
                        _touch.treeView.replaceNode(treeView, result);
                        var uiAlterationScripts = [];
                        var trigger;
                        for (var key in patchMap) {
                            var propDef = patchMap[key];
                            trigger = calculateStudioTrigger(trigger, propDef)
                            if (trigger == 'none' && propDef.alterApp)
                                uiAlterationScripts.push(propDef.alterApp);
                        }
                        if (uiAlterationScripts.length) {
                            targetObj._context = _touch.treeView.data();
                            postMessageToApp({ method: 'alterUI', scripts: uiAlterationScripts, context: targetObj })
                            delete targetObj._context;
                        }

                        if (trigger != 'none')
                            appShield('trigger', trigger);

                        // merge the "current" values with the "original"" ones to ensure that every new iteration of values is patched
                        var dataView = _touch.dataView(),
                            data = dataView?.data();
                        if (data) {
                            for (var key in data) {
                                var field = dataView.findField(key);
                                if (field)
                                    dataView._originalRow[field.Index] = data[key];
                            }
                            clearDynamicLookupCachesInPropGrid();
                        }
                    })
                    .catch(studioError);
        }
    }

    function calculateStudioTrigger(trigger, newTrigger) {
        var trigger;
        var propDef;
        if (typeof newTrigger == 'object') {
            propDef = newTrigger;
            newTrigger = propDef.alterApp ? 'none' : propDef.trigger || 'reload';
        }
        if (newTrigger) {
            if (newTrigger === 'none') {
                if (!trigger)
                    trigger = newTrigger;
            }
            else if (newTrigger === 'generate') {
                if (trigger !== 'refresh' && trigger !== 'sync')
                    trigger = newTrigger;
            }
            else if (newTrigger === 'reload') {
                if (trigger !== 'generate' && trigger !== 'refresh' && trigger !== 'sync')
                    trigger = newTrigger;
            }
            else if (newTrigger === 'refresh') {
                if (trigger !== 'sync')
                    trigger = newTrigger;
            }
            else if (newTrigger === 'sync') {
                trigger = newTrigger;
            }
            else {
                trigger = 'none'; // any other trigger is the script that needs to execute in the app (not in the studio)
            }
        }
        else
            trigger = 'reload';
        return trigger;
    }

    function studioActionHandler(options) {
        var target = options.target || $body,
            action = options.action,
            actionEvent = $.Event('studioaction' + action.replace(/\-/g, '') + '.app');

        if (appShield(':log')) {
            _touch.notify('App Studio is busy. Please wait...');
            return false;
        }
        else if (appShield(':active') && action.match(/^(exit|rotate|device|publish|inspect\-(start|end))$/)) {
            notifyApplicationChanged(action);
            return false;
        }

        hideSelectionMarker();

        target.trigger(actionEvent);
        if (!actionEvent.isDefaultPrevented()) {
            var feature = v9Feature[action];
            if (feature) {
                v9Feature._last = action;
                _touch.notify({ text: feature.text + ` is not supported in the release ${__settings.version}. The roadmap provides information about the alternative and the expected avaialability of this feature in the App Studio.`, duration: 'long', buttonText: 'Learn', buttonEvent: 'studiofeature.app' });
            }
            else if (action === 'help')
                window.open('https://codeontime.com/roadmap/v9', '_blank');
            else
                getStudioTools()
                    .then(() => {
                        var selectedTool = _app.studio.tools[action];
                        if (selectedTool)
                            selectedTool.run();
                        else
                            _touch.notify(`Tool "${action}" is not supported."`);
                    })
                    .catch(ex => {

                    });
        }
    }

    function notifyIncompleteImplementation(action) {
        let feature = v9Feature[action];
        if (feature && !feature._notified) {
            feature._notified = true;
            if (!$('.studio-selector:visible').length) {
                var appGenVersion = __settings.version.split(/\./g);
                appGenVersion.splice(appGenVersion.length - 1, 1, '0')
                _touch.notify({ text: feature.text + ` is not fully implemented in the release ${appGenVersion.join('.')}. The roadmap provides information about the alternative and the expected avaialability of this feature in the App Studio.`, duration: 'long', buttonText: 'Learn', buttonEvent: 'studiofeature.app' })
            }
        }
    }

    function studioError(ex) {
        _touch.notify(studioErrorMessage(ex));
    }

    function appIsNotOperational(ex) {
        appShield('error');
        _touch.notify({ text: 'The app is not operational. Review the log for errors.' + (ex ? 'Error: ' + ex.message : ''), duration: 'long' });

    }

    function fetchHierarchy(url) {
        var result = $app.studio.tools.cache[url];
        if (result)
            return Promise.resolve(result);
        return studioRestful({
            url,
            cache: true
        }).then(result => {
            $app.studio.tools.cache[url] = result;
            return Promise.resolve(result);
        });
    }

    function fetchObject(objectType) {
        if (!objectType)
            return Promise.resolve(null);
        var result = $app.studio.tools.cache[objectType];
        if (result)
            return Promise.resolve(result);
        return studioRestful({
            //hypermedia: `projects >> ${_app.id} >> session >>`,
            url: `/v2/studio/objects/${objectType}/definition`,
            cache: true
        })
            .then(result => {
                for (var key in result)
                    result[key].scope = objectType;
                $app.studio.tools.cache[objectType] = result;
                return Promise.resolve(result);
            })
    }

    function fetchFromProject(options) {
        var hypermedia = options.hypermedia,
            context = options.context;
        if (!hypermedia && !context)
            return Promise.resolve(null);
        hypermedia = context ?
            hypermedia :
            `projects >> ${_app.id} >> ${hypermedia}`;
        return studioRestful({
            hypermedia,
            context,
            cache: true
        }).then(response => {
            if (Array.isArray(response))
                return Promise.resolve({ collection: response });
            return Promise.resolve(response);
        });
    }

    function sessionMonitor(project) {
        var sessionId = project.result.sessionId;
        if (sessionId) {
            _app
                .restful({
                    baseUrl: _touch.studio(),
                    hypermedia: `projects >> ${_app.id} >> session >>`,
                    body: {
                        parameters: {
                            sessionId: sessionId
                        }
                    },
                    token: _app.studio.token
                })
                .then(project => {
                    // add content to the log
                    var log = project.result.log;
                    if (log.length) {
                        var studioLog = appShield();
                        var errorIndex = -1;
                        log.every((line, index) => {
                            if (line.match(/\.(\w+)?Exception/) && !studioLog.data('exception'))
                                errorIndex = index;
                            return errorIndex === -1;
                        });

                        if (errorIndex !== -1) {
                            var logBefore = log.slice(0, errorIndex);
                            if (logBefore.length)
                                $div().text(logBefore.join('\n')).appendTo(studioLog);
                            $div().attr('style', 'background-color:red;').text(log[errorIndex]).appendTo(studioLog);
                            log.splice(0, errorIndex + 1);
                            studioLog.data('exception', true);
                        }
                        if (log.length)
                            $div().text(log.join('\n')).appendTo(studioLog);
                        studioLog.scrollTop(studioLog[0].scrollHeight - studioLog.height());
                    }
                    // stop or continue monitoring
                    if (project.result.done) {
                        var exception = studioLog.data('exception');
                        if (exception)
                            _touch.notify({ text: 'An exception was detected. Please review the log.', duration: 60 * 1000 });
                        else
                            tryAppReload();
                    }
                    else {
                        setTimeout(sessionMonitor, project.result.timeout, project)
                    }
                })
                .catch(studioError);

        }
    }

    function tryAppReload() {
        var message = 'The app is about to reload...';
        if (appShield(':log'))
            message = 'The project has been regenerated. ' + message;
        _touch.notify({ text: message, duration: 'long' });
        fetch('_appstudio')
            .then(response => response.text())
            .then(page => {
                var studioLog = appShield();

                function dumpSource() {
                    if (!dumpSource._done) {
                        dumpSource._done = true;
                        // find the sample code with the error
                        var pre = page.match(/<code><pre>([\s\S]+)?<\/pre><\/code>/);
                        if (pre) {
                            $(pre[0]).appendTo(studioLog);
                        }
                    }
                }

                if (page.match(/var __settings=\{/))
                    postMessageToApp({ method: 'reload' })
                else {
                    $('<div><br/></div>').appendTo(studioLog);
                    // iterate the line number and other details
                    var detailIterator = /<b>(.+):\s*<\/b>(.+)\r*\n/g;
                    var detail = detailIterator.exec(page);
                    while (detail) {
                        $('<div>' + detail[0].replace(/<br>/g, '') + '</div>').appendTo(studioLog);
                        if (detail[2] && !detail[2].replace(/<br>/g, ''))
                            dumpSource();
                        detail = detailIterator.exec(page);
                    }
                    dumpSource();
                    // scroll to the bottom
                    studioLog.scrollTop(studioLog[0].scrollHeight - studioLog.height());
                    appIsNotOperational();
                }

            })
            .catch(appIsNotOperational);
    }

    function studioErrorMessage(ex) {
        var genericError = ex || { message: 'Unable to execute' };
        var restfulErrors = ex.errors,
            message = [];
        if (restfulErrors)
            restfulErrors.forEach(err => message.push(err.message));
        return { text: restfulErrors ? message.join('\n') : _app.studio.tools ? (genericError.message + (ex.stack ? `\nStack:${ex.stack}` : '')) : `Start "${_touch.appName()}" from the App Studio.\nError: ${genericError.message}.`, duration: 30000 };
    }

    window.addEventListener('message', function (e) {
        var method = e.data.method;
        if (method === 'inspect') {
            _app.studio.getScript('~/js/studio/inspector.js')
                .then(() =>
                    _app.studio.inspect(e.data.at.x, e.data.at.y)
                ).catch(ex =>
                    postMessageToStudio({
                        method: 'notify',
                        message: studioErrorMessage(ex)
                    }));
        }
        else if (method === 'explore') {
            // designer
            var bounds = e.data.bounds;
            var navigatePath = e.data.navigate;
            _selectionMarker.show().css({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height });
            var showPropPath = true;
            if (navigatePath) {
                var hierarchyInfo = navigatePath.split(/^(.+?)\:\/\//);
                if (hierarchyInfo) {
                    if (!navigatePath.match(/^explore/))
                        showPropPath = false;
                    _app.userVar('treeview.studio.' + hierarchyInfo[1], navigatePath);
                    $(document).trigger(`studioaction${hierarchyInfo[1]}.app`);
                }
            }
            showInspectionResult(showPropPath ? e.data.selector : false);

        }
        else if (method === 'started') {
            // app
            $body.addClass('studio-mode');
            _frame.css('left', '');
            _touch.busy(false);
            $('.studio-btn-inspect i').text('point_scan'); // restore the icon of the "inspect" button
        }
        else if (method === 'enableVirtualDevice') {
            // app
            if (!_screen.isVirtual) {
                var device = _app.userVar('lastVirtualDevice');
                if (device)
                    device.autoRotate = true;
                if (!device || !device.width)
                    device = { name: 'Responsive', width: 'auto', height: 'auto' };
                changeDevice(device);
            }
            updateVirtualDevice();
            updateStudioTools();
            hideToolbarsIfStudioIsHidden();
            if (_startOptions) {
                var event = _startOptions.event;
                if (event)
                    postMessageToStudio({ method: 'trigger', event: event });
            }
            _startOptions = null;
        }
        else if (method === 'hide') {
            // app
            if (_frame)
                _frame.remove();
            _frame = null;
            $body.removeClass('studio-mode');
            ensureStudioControls();
            var activeScrollable = $('.ui-popup-active,.ui-panel-open').find('.app-has-scrollbars');
            if (activeScrollable.length)
                activeScrollable.trigger('focus');
            else {
                $('.ui-page-active').trigger('focus');
                try {
                    var state = window.history.state;
                    if (state && originalState && state.url !== originalState.url) {
                        window.history.replaceState(originalState, null);
                        originalState = null;
                    }
                }
                catch (ex) {
                    // do nothing
                }
            }
        }
        else if (method === 'exit') {
            // app
            if (isStudio)
                appStudioExit();
            else
                exitVirtualScreen();
        }
        else if (method === 'trigger') {
            var ev = $.Event(e.data.event.type, e.data.event.data);
            $(this.document).trigger(ev);
        }
        else if (method === 'notify')
            _touch.notify(e.data.message);
        else if (method === 'reload') {
            location.replace(location.pathname);
        }
        else if (method === 'changeDevice') {
            changeDevice(e.data.device);
            if (e.data.exitStudio)
                postMessageToStudio({ method: 'exit' })
        }
        else if (method === 'virtualDeviceChanged') {
            $('[data-studio-action="device"] .studio-btn-label').html(e.data.options.text);
            appScreen = e.data.options.screen;
            // create or the app skirt
            var skirtTop = $('.studio-skirt-top');
            if (!skirtTop.length)
                skirtTop = $div('studio-skirt studio-skirt-top').appendTo($body);
            skirtTop.css({ left: 0, top: 0, height: appScreen.top, right: 0 });
            var skirtBottom = $('.studio-skirt-bottom');
            if (!skirtBottom.length)
                skirtBottom = $div('studio-skirt studio-skirt-bottom').appendTo($body);
            skirtBottom.css({ left: 0, bottom: 0, height: appScreen.bottom, right: 0 });
            var skirtLeft = $('.studio-skirt-left');
            if (!skirtLeft.length)
                skirtLeft = $div('studio-skirt studio-skirt-left').appendTo($body);
            skirtLeft.css({ left: 0, bottom: 0, width: appScreen.left, top: 0 });
            var skirtRight = $('.studio-skirt-right');
            if (!skirtRight.length)
                skirtRight = $div('studio-skirt studio-skirt-right').appendTo($body);
            skirtRight.css({ right: 0, bottom: 0, width: appScreen.right, top: 0 });
            // update the studio log
            appShield('reposition');
            $('.studio-inspection-result').hide();
        }
        else if (method === 'studioToolsChanged')
            $('[data-studio-action="rotate"]').toggleClass('studio-btn-hidden', !e.data.tools.rotate);
        else if (method === 'alterUI') {
            var triggerData = e.data;
            if (!isStudio) {
                e.data.scripts.forEach(script => {
                    try {
                        _app.eval(script, e.data.context);
                    }
                    catch (ex) {
                        postMessageToStudio({
                            method: 'notify',
                            message: ex.message
                        })
                    }
                });
            }
        }
        else if (method == 'shield') {
            if (isStudio) {
                appShield(e.data.args.method, e.data.args.options)
            }
        }
    });

    if (!isStudio && !_touch.activePage().length)
        _app.studio._started = false;

    function hideToolbarsIfStudioIsHidden() {
        if (!isStudio)
            $body.toggleClass('studio-hidden', _screen.width === _screen.physicalWidth);
    }

    function showInspectionResult(selector) {

        if (!selector) {
            $('.studio-inspection-result').empty();
            return;
        }

        var html = [];

        function add(value, type) {
            if (value != null) {
                if (value === '')
                    value = '(blank)';
                if (html.length)
                    html.push(' / ');
                html.push(`<span title="${type}" data-tooltip-location="above">${_app.htmlEncode(value)}</span>`);
            }
        }

        //add(selector.page, 'Page');
        add(selector.controller, 'Controller');
        if (selector.type === 'page') {
            add(selector.page, 'Page');

        }
        else if (selector.action) {
            add(selector.actionGroup, 'Action Group');
            add(selector.action, 'Action');
        }
        else {
            add(selector.view, 'View');
            add(selector.category, 'Category');
            add(selector.fieldName, 'Data Field');
        }
        if (selector.property)
            add(_app.prettyText(selector.property), 'Property');
        var inspectionResult = $('.studio-inspection-result');
        if (!inspectionResult.length)
            inspectionResult = $div('studio-inspection-result').appendTo($body);
        inspectionResult.html(`<span class="path"><b>${_app.prettyText(selector.type, true)}</b>: ${html.join('')}</span>`).show();
        var resultPath = inspectionResult.find('.path');
        resultRect = _app.clientRect(resultPath);
        var deviceButtonRect = _app.clientRect($('[data-studio-action="device"]'));
        inspectionResult.hide();
        if (deviceButtonRect.right > resultRect.left) {
            _touch.notify({ text: resultPath.html(), duration: 'long', htmlEncode: false });
        }
        else {
            _touch.notify(false);
            setTimeout(() => inspectionResult.css('color', '#ff0000').fadeIn(750));
        }
    }

    function ensureStudioControls(fadeIn) {
        if (!isStudio && !_screen.isVirtual && _app.userVar('studioOnStart?') !== false) {
            changeDevice({ name: "Responsive", width: 'auto', height: 'auto' });
            _touch.screen('resize');
        }

        if ($('.studio-btn-inspect').length) return;

        if (fadeIn) {
            $body.addClass('studio-controls-hidden');
            if (_screen.isVirtual && !isStudio)
                appStudioHint(true);
        }

        hideToolbarsIfStudioIsHidden();

        // Toolbar: "Top"     -----------------------------
        var toolbarTop = $div('studio-toolbar studio-toolbar-top').appendTo($body);

        // inspect/exit

        var inspectionMode = isStudio && isInspecting;
        _touch.icon('material-icon-' + (inspectionMode ? 'arrow-selector-tool' : 'point_scan'),
            $div('studio-btn studio-btn-inspect')
                .attr({
                    'data-studio-action': inspectionMode ? 'inspect-end' : 'inspect-start',
                    'title': inspectionMode ? 'End Inspection' : 'Inspect'
                })
                .appendTo(toolbarTop));

        // settings
        _touch.icon('material-icon-settings',
            $div('studio-btn')
                .attr('data-studio-action', 'settings')
                .attr('title', 'Settings')
                .appendTo(toolbarTop));

        // models
        _touch.icon('material-icon-account-tree',
            $div('studio-btn')
                .attr('data-studio-action', 'models')
                .attr('title', 'Models')
                .appendTo(toolbarTop));


        // pages
        _touch.icon('material-icon-menu-book',
            $div('studio-btn')
                .attr('data-studio-action', 'pages')
                .attr('title', 'Pages')
                .appendTo(toolbarTop));

        // develop
        _touch.icon('material-icon-webhook',
            $div('studio-btn')
                .attr('data-studio-action', 'develop')
                .attr('title', 'Develop')
                .appendTo(toolbarTop));

        // files
        _touch.icon('material-icon-folder-open',
            $div('studio-btn')
                .attr('data-studio-action', 'open')
                .attr('title', 'Show Source Code')
                .appendTo(toolbarTop));

        // sync
        _touch.icon('material-icon-sync',
            $div('studio-btn')
                .attr('data-studio-action', 'sync')
                .attr('title', 'Sync Design')
                .appendTo(toolbarTop));

        // publish
        _touch.icon('material-icon-publish',
            $div('studio-btn')
                .attr('data-studio-action', 'publish')
                .attr('title', 'Publish')
                .appendTo(toolbarTop));

        // exit
        _touch.icon('material-icon-exit-to-app',
            $div('studio-btn')
                .attr('data-studio-action', 'exit')
                .attr('title', 'Exit to App')
                .appendTo(toolbarTop));

        // rotate
        _touch.icon('material-icon-screen-rotation-alt',
            $div('studio-btn')
                .attr('data-studio-action', 'rotate')
                .attr('title', 'Rotate')
                .appendTo(toolbarTop));

        // Toolbar: "Bottom"  -----------------------------
        var toolbarBottom = $div('studio-toolbar studio-toolbar-bottom').appendTo($body);

        // devices
        var deviceBtn = $div('studio-btn')
            .attr('data-studio-action', 'device')
            .attr('title', 'Device')
            .attr('data-tooltip-location', 'above')
            .attr('data-tooltip-align', 'left')
            .appendTo(toolbarBottom);
        _touch.icon('material-icon-devices', deviceBtn);
        $div('studio-btn-label').appendTo(deviceBtn).text('iPad 1024 x 768');


        // Toolbar: "Left"    -----------------------------
        var toolbarLeft = $div('studio-toolbar studio-toolbar-left').appendTo($body);

        // apps
        _touch.icon('material-icon-apps',
            $div('studio-btn')
                .attr('data-studio-action', 'apps')
                .attr('title', 'Apps')
                .appendTo(toolbarLeft));
        // widgets
        _touch.icon('material-icon-widgets',
            $div('studio-btn')
                .attr('data-studio-action', 'widgets')
                .attr('title', 'Widgets')
                .attr('data-tooltip-location', 'above')
                .attr('data-tooltip-align', 'left')
                .appendTo(toolbarLeft));

        // Toolbar: "Right"  -----------------------------
        var toolbarRight = $div('studio-toolbar studio-toolbar-right').appendTo($body);

        // more
        _touch.icon('material-icon-more-' + (_app.agent.android ? 'vert' : 'horiz'),
            $div('studio-btn')
                .attr('data-studio-action', 'more')
                .attr('title', 'More')
                .appendTo(toolbarRight));

        // properties
        _touch.icon('material-icon-build',
            $div('studio-btn')
                .attr('data-studio-action', 'explore')
                .attr('title', 'Project Explorer')
                .attr('data-tooltip-location', 'left')
                .appendTo(toolbarRight));

        // help
        _touch.icon('material-icon-help',
            $div('studio-btn')
                .attr('data-studio-action', 'help')
                .attr('title', 'Help')
                .attr('data-tooltip-location', 'left')
                .appendTo(toolbarRight));

        if (!isStudio) {
            updateVirtualDevice();
            updateStudioTools();
        }

        disableStudioControlsWhenAppShield();

        if (fadeIn)
            setTimeout(() => $body.removeClass('studio-controls-hidden'), 32);
    }

    function changeDeviceEx(context) {
        changeDevice(context.device, context.exitStudio)
    }

    function changeDevice(device, exitStudio) {
        device = JSON.parse(JSON.stringify(device)); // clone the device
        if (isStudio) {
            appScreen = device;
            device.autoRotate = true;
            postMessageToApp({ method: 'changeDevice', device, exitStudio });
        }
        else {
            _device = device;

            var deviceWidth = device.width,
                deviceHeight = device.height;

            if (deviceWidth == null)
                _screen.isVirtual = false;
            else if (deviceWidth === 'auto')
                _screen.isVirtual = true;
            else {
                _screen.isVirtual = true;
                _screen.width = deviceWidth;
                _screen.height = deviceHeight;
                device.width = _screen.width;
                device.height = _screen.height;
            }
            if (device.autoRotate) {
                delete device.autoRotate;
                if (deviceHeight !== 'auto' && deviceHeight > _screen.physicalHeight - 112 && device.height > deviceWidth) {
                    device.width = _screen.width = deviceHeight;
                    device.height = _screen.height = deviceWidth;
                }
            }
            _touch.device(device);
            _screen.deviceWidth = _screen.deviceHeight = null;
            _touch.screen('resize');
            updateStudioTools(device);
        }
    }

    function updateStudioTools(device) {
        if (!device)
            device = _touch.device();
        var rotate = device.name !== 'Responsive';
        $('[data-studio-action="rotate"]').toggleClass('studio-btn-hidden', !rotate);
        postMessageToStudio({ method: 'studioToolsChanged', tools: { rotate } });
    }

    function findVirtualDevice() {
        var device = _touch.device(),
            vd = virtualDeviceList.find(vd => vd.name === device.name);
        if (vd && vd.width === 'auto' || !device.name)
            vd = { name: 'Responsive', width: _screen.physicalWidth - 112, height: _screen.physicalHeight - 112 };
        return vd || device;
    }

    function updateVirtualDevice() {
        if (!isStudio) {
            var deviceLabel = $('[data-studio-action="device"] .studio-btn-label'),
                device = _touch.device();
            var deviceName = device.width === 'auto' || device.width === _screen.width && device.height == _screen.height ? device.name + ' ' : '',
                text = `${deviceName}${_screen.width} x ${_screen.height}`;
            deviceLabel.html(text);
            postMessageToStudio({ method: 'virtualDeviceChanged', options: { text, screen: _screen } });
        }
    }

    function notifyApplicationChanged(action) {
        var studioState = _app.studio.state();
        var trigger = studioState?.trigger || 'reload';
        _touch.notify({
            text: (action ? 'This tool is not available in the changed application.' : 'Application has changed. Use the available studio tools to make other changes.') + ` Click anywhere in the app boundaries to ${trigger}.`,
            duration: 'long',
            buttonText: trigger,
            buttonEvent: 'execstudiotrigger.app'
        });
    }

    function disableStudioControlsWhenAppShield() {
        if (isStudio && $('.studio-app-shield').length)
            ['inspect-start', 'inspect-end', 'exit', 'rotate', 'publish', 'device'].forEach(action =>
                $(`[data-studio-action="${action}"]`).addClass('studio-disabled')
            );
    }

    function appShield(method, options) {
        if (options == null)
            options = {};


        var shield = options.shield || $('.studio-app-shield');
        if (method) {
            if (!isStudio && !method.match(/^\:/)) {
                postMessageToStudio({ method: 'shield', args: { method, options } });
                return;
            }
            switch (method) {
                case 'show':
                    if (!shield.length) {
                        shield = $div('studio-app-shield').appendTo($body);
                        appShield('reposition', { shield });
                    }
                    disableStudioControlsWhenAppShield();
                    break;
                case 'reposition':
                    shield.css({
                        left: appScreen.left,
                        top: appScreen.top,
                        right: appScreen.right,
                        bottom: appScreen.bottom
                    });
                    break;
                case 'trigger':
                    if (!shield.length)
                        shield = appShield('show');
                    var studioState = _app.studio.state();
                    studioState.trigger = calculateStudioTrigger(studioState.trigger, options);
                    _app.studio.state(studioState);
                    shield.removeClass('studio-log').removeData('exception').empty();
                    break;
                case 'log':
                    if (!shield.length)
                        shield = appShield('show').attr('data-context-menu', true);
                    shield.addClass('studio-log').removeData('exception').empty().removeClass('studio-error');
                    _touch.notify(false);
                    break;
                case ':log':
                    return shield.is('.studio-log:not(.studio-error)') && !shield.data('exception');
                case ':active':
                    return !!shield.length;
                default:
                    if (method.match(/^\:/))
                        return shield.is('.studio-' + method.substring(1));
                    shield.addClass('studio-' + method);
                    break;
            }
        }
        return shield;
    }

    _app.studio.shield = appShield;

    _app.studio.state = function (state) {
        if (arguments.length)
            if (state == null)
                localStorage.removeItem('studio.state');
            else
                localStorage.setItem('studio.state', JSON.stringify(state));
        else {
            state = localStorage.getItem('studio.state');
            return state != null ? JSON.parse(state) : {};
        }
    }

    function executeStudioTrigger() {
        var studioState = _app.studio.state();
        switch (studioState.trigger) {
            case 'reload':
                _app.studio.state(null);
                tryAppReload();
                break;
            case 'generate':
                _app.studio.state(null);
                appShield('log');
                getStudioTools()
                    .then(() =>
                        _app.studio.tools.generate.run()
                    )
                    .then(sessionMonitor)
                    .catch(studioTriggerError);
                break;
            case 'refresh':
                _app.studio.state(null);
                appShield('log');
                getStudioTools()
                    .then(() =>
                        _app.studio.tools.sync.run({ metadata: false })
                    )
                    .then(sessionMonitor)
                    .catch(studioTriggerError);
                break;
            case 'sync':
                _app.studio.state(null);
                appShield('log');
                getStudioTools()
                    .then(() =>
                        _app.studio.tools.sync.run({ metadata: true })
                    )
                    .then(sessionMonitor)
                    .catch(studioTriggerError);
                break;
        }
    }

    function studioTriggerError(ex) {
        appShield().remove();
        studioError(ex);
    }

    $(document)
        .on('invokegetpage.app', e => {
            var restfulOptions = e.invoke.params.controller.match(/^data\:application\/json\;base64\s(.+?)$/);
            if (restfulOptions) {
                var targetObj = _touch.dataView()._survey.context.target;
                targetObj._context = _touch.propGrid.data;
                // adjust the 'hypermedia' option
                var options = JSON.parse(atob(restfulOptions[1]));
                if (options.hypermedia) {
                    if (options.hypermedia.match(/\$\{/))
                        options.hypermedia = _app.eval(options.hypermedia, targetObj);

                    options.hypermedia = `projects >> ${_app.id} >> ${options.hypermedia}`
                }
                // adjust the 'filter' option
                if (options?.query?.filter)
                    options.query.filter = _app.eval(options.query.filter, targetObj);
                // set up the default properties
                delete targetObj._context;
                options.cache = true;
                studioRestful(options)
                    .then(resource => {
                        if (options.processor)
                            _app.eval(options.processor, resource);
                        var response = _app.studio.utils.resourceToViewPage(resource);
                        e.invoke.params.controller = response.Controller;
                        e.invoke.success(response);
                    })
                    .catch(studioError);

                return false;
            }

        })
        .on('invokegetpagelist.app', e => {

        })
        .on('pointerdown mousedown touchstart', '[data-studio-link]', function (e) {
            var link = $(this).attr('data-studio-link');
            if (link && link.match(/^http/)) {
                window.open(link, '_blank')
                return false;
            }
        });

    // Create a "lookup" response from the RESTful resource. It includes two fields with the generic names. The field property is both the primary key and the value

    function studioRestful(options) {
        options.baseUrl = _touch.studio();
        options.token = _app.studio.token;
        return _app.restful(options);
    }

})();