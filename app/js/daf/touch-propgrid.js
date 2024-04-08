/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Touch UI - Property Grid
* Copyright 2021-2024 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/

(function () {
    var _app = $app,
        _input = _app.input,
        _touch = _app.touch,
        $document = $(document),
        resources = Web.DataViewResources,
        booleanDefaultItems = resources.Data.BooleanDefaultItems,
        getBoundingClientRect = _app.clientRect,
        // core variables
        booleanValues = [{ value: false, text: booleanDefaultItems[0][1] }, { value: true, text: booleanDefaultItems[1][1] }],
        propSetMap = {},
        _propCollapsed,
        unknownPropSet = {
            misc: {
                scope: '_unknown'
            }
        },
        activePage = _touch.activePage,
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

    function propCollapsed(name, value) {
        if (!_propCollapsed)
            _propCollapsed = _app.userVar('propCollapsed') || {};
        if (arguments.length === 2) {
            if (value === null)
                delete _propCollapsed[name];
            else
                _propCollapsed[name] = value;
            _app.userVar('propCollapsed', _propCollapsed);
        }
        else
            return _propCollapsed[name];
    }

    function enumerateCatProperties(parentDef) {
        var catTextNames = [],
            propTextMap = {},
            propList = parentDef.properties,
            primaryProp,
            propCount = 0,
            conditionallyVisiblePropCount = 0;
        if (!propList)
            propList = parentDef.properties = {};
        for (var propName in propList) {
            var propDef = propList[propName];
            if (!propDef)
                propDef = propList[propName] = {}
            propDef.parent = parentDef;
            propCount++;
            if (!propDef.name)
                propDef.name = propName;
            if (!propDef.text)
                propDef.text = _app.prettyText(propName, true);
            if (!propDef.type)
                propDef.type = 'text';
            if (propDef.type === 'text' && !('length' in propDef))
                propDef.length = 255;
            if (propDef.type === 'bool') {
                if (!propDef.style)
                    propDef.style = 'DropDownList';
            }
            if (propDef.values && !propDef.style)
                propDef.style = 'DropDownList';
            if (propDef.style && !('required' in propDef))
                propDef.placeholder = '(not set)';

            if (propDef.type === 'bool' && propDef.style === 'DropDownList')
                propDef.values = booleanValues;
            if (propDef.primary)
                primaryProp = propDef;

            if (parentDef.visible) {
                propDef.visible = propDef.visible ? `(${parentDef.visible})&&(${propDef.visible})` : parentDef.visible;
                conditionallyVisiblePropCount++;
            }
            else if (propDef.visible)
                conditionallyVisiblePropCount++;

            //catPropNames.push(propName);
            var textIndex = propDef.text + '|' + propName;
            catTextNames.push(textIndex);
            propTextMap[textIndex] = propDef;
            if (propDef.properties)
                enumerateCatProperties(propDef);
        }
        if (parentDef.parent && propCount && propCount === conditionallyVisiblePropCount)
            parentDef.complexOnDemand = true;
        //catPropNames = propList._names = catPropNames.sort();
        var catPropNames = propList._names = [];
        catTextNames.sort().forEach(textIndex => {
            catPropNames.push(propTextMap[textIndex].name);
        });
        if (primaryProp) {
            catPropNames.splice(catPropNames.indexOf(primaryProp.name), 1);
            if (primaryProp.visible != null)
                catPropNames.forEach(name => {
                    var propDef = propList[name];
                    propDef.visible = propDef.visible ? `(${primaryProp.visible})&&(${propDef.visible})` : primaryProp.visible;
                });
            catPropNames.splice(0, 0, primaryProp.name);
        }
    }

    _touch.propSet = function (propSet) {
        if (propSet._registered)
            return;
        var scope = '_unknown';
        for (var catName in propSet) {
            var catDef = propSet[catName];
            scope = catDef.scope;
            var scopeDef = propSetMap[scope];
            if (!scopeDef)
                scopeDef = propSetMap[scope] = { _names: [] };
            scopeDef[catName] = catDef;
            scopeDef._names.push(catName);
            if (!catDef.name)
                catDef.name = catName;
            if (!catDef.text)
                catDef.text = _app.prettyText(catName, true);
            if (catDef.visible) {
                var firstAlwaysVisible = null;
                var primaryProp = null;
                for (var propName in catDef.properties) {
                    var p = catDef.properties[propName];
                    if (p.primary) {
                        if (primaryProp)
                            delete p.primary;
                        else
                            primaryProp = p;
                    }
                    else if (!p.visible && !firstAlwaysVisible)
                        firstAlwaysVisible = p;

                }
                if (primaryProp)
                    primaryProp.visible = primaryProp.visible ? `(${catDef.visible})&&(${primaryProp.visible})` : catDef.visible;
                else if (firstAlwaysVisible) {
                    firstAlwaysVisible.visible = catDef.visible;
                    firstAlwaysVisible.primary = true;
                }
            }
            enumerateCatProperties(catDef);
        }
        propSet._registered = scope;
    };

    _touch.propGrid = function (method, options) {
        var propSet = options.propSet,
            use = options.use,
            questions = [],
            values = {},
            //values = [],
            targetObj = options.target || {},
            layoutOfCategories = [],
            layoutOfProps = [],
            categoryList = [],
            categoryMap = {},
            error,
            isCollapsedCat,
            isExistingInstance = _touch.dataView()?._survey?.context?.instance === options.instance,
            userWidth = isExistingInstance ? _app.clientRect(activePage()).width : propGridComponentProperty('width', options.instance),
            modalWidth = userWidth ? Math.min(userWidth, $(window).width() - propGridMinDividerX() * 2) : null,
            defaultPropGridWidth = modalWidth ? _touch.toWidth(modalWidth) : 'xxs',
            propGridWidth = modalWidth || _touch.toWidth(defaultPropGridWidth),
            propLabelWidth = Math.min(Math.ceil(propGridWidth - propGridMinDividerX()), propGridComponentProperty('divider.x', options.instance) || Math.ceil(propGridWidth / 2)),
            propFieldWidth = propGridWidth - propLabelWidth - 7;

        if (!options.context)
            options.context = 'generic';
        options.propMap = {};

        if (!use && propSet)
            for (var key in propSet)
                if (!use)
                    use = propSet[key].scope;

        if (typeof use == 'string')
            use = use.split(/\s*,\s*/);

        canEvaluate(targetObj, true);
        //targetObj._get = propertyGetter

        function layout(s) {
            var argList = arguments,
                offset = 1,
                target = arguments[0],
                i,
                line = [];
            if (argList.length === 1 || argList.length > 1 && !(argList[0] === 'categories' || argList[0] === 'props')) {
                offset = 0;
                target = 'all';
            }
            for (i = offset; i < argList.length; i++)
                line.push(argList[i]);

            line = line.join('');

            if (target === 'categories' || target === 'all')
                layoutOfCategories.push(line);
            if (target === 'props' || target === 'all')
                layoutOfProps.push(line);
        }

        function question(catDef, propDef, prefix, depth, collapsedParent) {
            var
                v,
                q = {
                    name: (prefix ? prefix + '_' : '') + propDef.name,
                    type: propDef.type,
                    text: propDef.text,
                    options: propDef.options || {},
                    causesCalculate: true
                };
            propDef.propName = q.name;
            if (!('spellCheck' in q.options))
                q.options.spellCheck = false;
            options.propMap[q.name] = propDef;
            if (propDef.compound) {
                if (typeof propDef.compound == 'string')
                    propDef.compound = propDef.compound.split(/\s*,\s*/g);
                propDef.readOnly = true;
                propDef.virtual = true;
                if (!('expanded' in propDef))
                    propDef.expanded = false;
            }
            if (propDef.readOnly != null) {
                if (propDef.readOnly === true)
                    q.readOnly = true;
                else
                    q.readOnlyWhen = propDef.readOnly;

            }
            if (propDef.required)
                q.required = true;
            if (propDef.mode)
                q.mode = propDef.mode;
            if (propDef.style) {
                q.items = { style: propDef.style };
                var propDefValues = propDef.values;
                if (propDefValues != null) {
                    if (typeof propDefValues == 'string')
                        propDefValues = propDefValues.split(/\s*,\s*/g);
                    if (Array.isArray(propDefValues)) {
                        q.items.list = [];
                        propDefValues.forEach(function (v) {
                            if (typeof v == 'string')
                                v = { value: v, text: _app.prettyText(v, true) };
                            q.items.list.push(v);
                        });
                        if (!('default' in propDef))
                            propDef.default = q.items.list[0].value;
                        propDef.values = q.items.list;
                    }
                    else if (typeof propDefValues == 'object') {
                        q.items.controller = 'data:application/json;base64 ' + btoa(JSON.stringify(propDefValues));
                        q.items.style = 'AutoComplete';
                        q.items.dataValueField = 'value';
                        q.items.dataTextField = 'value';
                        //    var dataView = _touch.dataView();
                        //    if (dataView && dataView.findField(q.name))
                        //        dataView.session(q.name + '_listCache');
                    }
                }
                if (propDef.style === 'DropDownList')
                    q.options.lookup = { nullValue: false };

            }

            if ('default' in propDef) {
                if (propDef.type && propDef.type.match(/^int/i) && typeof propDef.default == 'string')
                    propDef.default = parseInt(propDef.default);
                q.default = propDef.default;
            }

            if (propDef.placeholder)
                q.placeholder = propDef.placeholder;

            var isCollapsedProp = false;
            if (propDef.properties) {
                isCollapsedProp = propCollapsed(catDef.scope + '$' + q.name);
                if (isCollapsedProp == null)
                    isCollapsedProp = propDef.expanded === false;
            }

            v = evaluateProperty(propDef, targetObj);
            if (v == null && ('default' in propDef))
                v = q.default;
            values[q.name] = v;

            questions.push(q);
            var propClasses = [];
            if (isCollapsedCat)
                propClasses.push('app-collapsed-cat');
            if (propDef.properties) {
                propClasses.push('app-complex');
                if (propDef.complexOnDemand)
                    propClasses.push('app-complex-on-demand');
            }
            if (isCollapsedProp)
                propClasses.push('app-collapsed');
            if (collapsedParent)
                propClasses.push('app-collapsed-prop')
            layout('<div data-container="row" ',
                'data-property="', q.name, '"');
            if (propDef.visible) {
                q.visibleWhen = propDef.visible;
                layout(
                    'data-visibility="f:', q.name, '"');
            }
            layout(
                'data-category-name="', catDef.name, '" ',
                'data-scope="', catDef.scope, '" ',
                propClasses.length ? 'class="' + propClasses.join(' ') + '" ' : '',
                depth ? 'data-depth="' + depth + '"' : '',
                '>');
            layout(`<span data-draggable="propgrid-divider" style="left:${propLabelWidth}px"></span>`);
            layout(`<span data-control="label" data-field="${q.name}" style="min-width:${propLabelWidth}px;max-width:${propLabelWidth}px;width:${propLabelWidth}px">${q.name}</span>`);
            //if (!propDef.properties)
            layout(`<span data-control="field" data-field="${q.name}" style="min-width:${propFieldWidth}px;max-width:${propFieldWidth}px;width:${propFieldWidth}px"`, '"', propDef.style === 'DropDownList' && false ? ' data-select-on-focus="false"' : '', '>[', q.name, ']</span>');
            if (propDef.properties)
                layout('<span class="app-toggle"></span>');
            layout('</div>');
            if (propDef.properties) {
                propDef.properties._names.forEach(function (propName) {
                    var childPropDef = propDef.properties[propName];
                    question(catDef, childPropDef, q.name, depth + 1, isCollapsedProp || collapsedParent)
                });
                calculateCompoundValue(propDef, q, options.propMap, values);
            }
        }

        if (propSet) {
            if (!Array.isArray(propSet))
                propSet = [propSet];
            propSet.forEach(function (propSet) {
                _touch.propSet(propSet);
            });
        }
        else {
            propSet = _touch.propSet(unknownPropSet);
            use = ['_unknown'];
        }

        var primaryCategory;

        use.forEach(function (name) {
            var propSet = propSetMap[name];
            if (!propSet)
                error = 'Unknown property set ' + name;
            else {
                categoryList = categoryList.concat(propSet._names);
                for (var catName in propSet) {
                    var ps = propSet[catName];
                    if (ps.primary)
                        primaryCategory = catName;
                    categoryMap[catName] = ps;
                }
            }
        });
        if (error) {
            _touch.notify(error);
            return;
        }

        // Generate "Categorized" layout
        layout('<div data-layout="form" data-layout-size="tn">');
        layout('<div data-container="simple">');

        categoryList.sort((a, b) => {
            var catA = categoryMap[a];
            var catB = categoryMap[b];
            if (catA.text === catB.text)
                return 0;
            return catA.text < catB.text ? -1 : 1;
        });

        if (primaryCategory) {
            categoryList.splice(categoryList.indexOf(primaryCategory), 1);
            categoryList.splice(0, 0, primaryCategory);
        }
        categoryList.forEach(function (catName) {
            var c = categoryMap[catName];
            var categoryLayoutIndex = layoutOfCategories.length;
            isCollapsedCat = propCollapsed(c.scope + '$' + c.name);
            layout('<div data-container="row" ',
                'data-category="', catName, '" ',
                'data-scope="', c.scope, '" ',
                'class="', isCollapsedCat ? 'app-collapsed' : '', '"',
                '>');
            layout('<span class="app-toggle"></span>');
            layout('<span class="app-cat-text">', _app.htmlEncode(c.text), '</span>');
            layout('</div>');
            c.properties._names.forEach(function (propName) {
                var p = c.properties[propName];
                // The visibility of the category depends on the "primary" field with the "visible" property.
                if (p.primary && p.visible)
                    layoutOfCategories[categoryLayoutIndex] = layoutOfCategories[categoryLayoutIndex].replace('>', ` data-visibility="f:${p.name}">`);
                question(c, p, '', 0, false);
            });

        });

        // emtpy data row to create a separator line
        layout('<div data-container="row">');
        layout('</div>');

        layout('</div>'); // data-container="simple"
        layout('</div>'); // data-layout="form"

        // generate "Alphabetical" layout


        // TODO: show the grid of properties

        //delete targetObj._get;
        canEvaluate(targetObj, false);

        _touch.whenPageShown(selectedNodeChanged);

        _app.survey({
            context: options,
            sharedInstance: options.instance ? options.instance + '_PropertiesWindow' : null,
            questions,
            values,
            options: {
                modal: {
                    dock: options.location || 'right',
                    max: defaultPropGridWidth,
                    width: modalWidth,
                    gap: false,
                    tapOut: true,
                    background: 'transparent',
                    title: false,
                    always: true
                },
                actionButtons: false,
                discardChangesPrompt: false,
                className: 'app-propgrid',
                contentStub: false
            },
            layout: layoutOfCategories.join('\n'),
            init: 'propgridinit.app',
            calculate: 'propgridcalc.app'
        });
    };

    _touch.propGrid.select = function (propertyName) {
        if (propertyName.match(/^\./))
            propertyName = propertyName.substring(1);
        propertyName = propertyName.replace(/\./g, '_');
        var property = activePage('[data-property="' + propertyName + '"]');
        if (property.length && property[0].style.display != 'none') {
            var parentCategory = property.prevAll('[data-category]:first');
            if (parentCategory.is('.app-collapsed'))
                parentCategory.find('.app-toggle').trigger('vclick');
            var parentProp = property;
            while (parentProp.length && property.is('.app-collapsed-prop')) {
                parentProp = parentProp.prevAll('[data-property].app-complex:first');
                if (parentProp.is('.app-collapsed')) {
                    parentProp.data('navigating', true).find('.app-toggle').trigger('vclick');
                    parentProp.removeData('navigating');
                }
            }
            _touch.scrollIntoView(property, 'center');
            var labelControl = property.find('[data-control="label"]');
            if (!labelControl.is('.app-has-focus')) {
                property.closest('[data-layout]').find('.app-has-focus').removeClass('app-has-focus');
                _touch.scrollable('focus');
                labelControl.trigger('vclick');
            }
        }
        else
            updatePropertyInfo();
    };


    _touch.propGrid.edit = function (propertyName) {
        _touch.propGrid.select(propertyName);
        _input.focus({ field: propertyName });
    };

    _touch.propGrid.data = function (type) {
        var obj = type ?
            _touch.treeView.data(type) :
            propGridContext().target;
        return obj || {};
    };

    _touch.propGrid.info = updatePropertyInfo;

    // UI event handlers

    function selectedNodeChanged(page) {
        var expandedCategories = page.find('[data-category]:not(.app-collapsed)');
        // ensure that at least one category is expanded
        if (!expandedCategories.length)
            page.find('[data-category]:first .app-toggle').trigger('vclick');

        page.find('.app-complex-on-demand').each(updateComplexityOnDemand);

        // scroll the last selected property into view
        var dataView = _touch.pageInfo().dataView;
        if (dataView) {
            var lastSelected = _app.userVar(`${dataView._survey.context.instance}.navigate`);
            if (lastSelected)
                _app.userVar(`${dataView._survey.context.instance}.navigate`, null);
            else
                lastSelected = _app.userVar(`${dataView._survey.context.instance}.${dataView._survey.context.propSet?._registered}.lastSelected`);
            if (lastSelected)
                _touch.propGrid.select(lastSelected);
            else
                _touch.propGrid.info();
        }

        setTimeout(updateNavToolbar);
    }

    function updateComplexityOnDemand() {
        var propElem = $(this);
        if (propElem.is('.app-complex-on-demand')) {
            var isComplex = false;
            var nextElem = propElem.next();
            while (!isComplex && nextElem.length && nextElem.is('[data-depth]')) {
                if (nextElem.is('[data-depth="1"]') && nextElem[0].style.display !== 'none')
                    isComplex = true;
                nextElem = nextElem.next();
            }
            propElem.toggleClass('app-complex-off', !isComplex);
        }
    }

    function updateNavToolbar() {
        var navigator = _touch.treeView.context();
        var buttonsToRemove = [];
        _touch.activePage('.app-toolbar-nav .app-btn').each(function () {
            var btn = $(this),
                action = btn.attr('data-pg-action');
            switch (action) {
                case 'propgrid.refresh':
                case 'propgrid.collapse-all':
                    // always enabled
                    break;
                case 'propgrid.properties':
                    btn.toggleClass('app-disabled', !navigator.node);
                    break;
                case 'propgrid.pin':
                    btn.toggleClass('app-disabled', !navigator.node);
                    break;
                default:
                    buttonsToRemove.push(btn);
                    break;
            }
        });
        buttonsToRemove.forEach(btn => {
            btn.remove();
        });
    }

    function updatePropGridLayout() {
        var controls = [];
        activePage('[data-layout]').data('rootNodes')[0].children.forEach(function (c) {
            if (!c.ready)
                controls.push(c);

        });
        if (controls.length)
            _touch.layout({ controls: controls });
    }

    function startVerticalResizing(collapsed) {
        var scrollable = _touch.scrollable();
        scrollable.find('.app-stub').css('height', getBoundingClientRect(scrollable).height);
    }

    function finishVerticalResizing() {
        var scrollable = _touch.scrollable(),
            scrollableRect = getBoundingClientRect(scrollable),
            stub = scrollable.find('.app-stub'),
            stubRect = getBoundingClientRect(stub);
        if (_app.intersect(scrollableRect, stubRect))
            stub.css('height', scrollableRect.bottom - stubRect.top + 1);
        else
            stub.css('height', '');
        //_touch.resetPageHeight();
    }

    function complexPropertyClick(e) {
        var property = $(this).closest('[data-property]'),
            complexPropNamePrefix = property.data('property') + '_', // prefix of the complex property 
            isCollapsed = !property.is('.app-collapsed'),
            propDef = toPropDef(property),
            propElem = property.next(),
            collapsedChild = [],
            lastPropElem;
        startVerticalResizing(isCollapsed);
        propCollapsed(property.data('scope') + '$' + property.data('property'), isCollapsed == true ? isCollapsed : propDef.expanded === false ? false : null);
        property.toggleClass('app-collapsed', isCollapsed);
        while (propElem.length && (propElem.data('property') || '').startsWith(complexPropNamePrefix)) {
            if (propElem.is('.app-collapsed'))
                collapsedChild.push(propElem.data('property'));
            if (isCollapsed)
                propElem.addClass('app-collapsed-prop');
            else {
                var expandedPropertyName = propElem.data('property'),
                    skipExpand = false;
                collapsedChild.forEach(function (collapsedName) {
                    if (expandedPropertyName.startsWith(collapsedName) && expandedPropertyName.length > collapsedName.length)
                        skipExpand = true;
                });
                if (!skipExpand)
                    propElem.removeClass('app-collapsed-prop');
            }
            lastPropElem = propElem;
            propElem = propElem.next();
        }
        if (!isCollapsed)
            updatePropGridLayout();
        _touch.hasFocus(property.find('[data-control="field"]'));
        finishVerticalResizing();
        if (!isCollapsed)
            scrollExpandedParentIntoView(property, lastPropElem);
        return false;
    }

    function selectCategory(cat, scrollIntoView) {
        if (scrollIntoView !== false)
            _touch.scrollIntoView(cat);
        activePage('.app-has-focus').removeClass('app-has-focus');
        cat.addClass('app-has-focus');
        activePage().removeData('last-focused-field');
        var catDef = toCatDef(cat);
        updateInfoPane(catDef.text, catDef.hint, false);

    }

    function updateInfoPane(title, text, help, seeAlso) {
        var infoPane = activePage().data('infoPane');
        if (infoPane) {
            infoPane.scrollTop(0);
            infoPane.find('.app-text').text(title || '');
            infoPane.find('.app-description').html(text || '');
            infoPane.find('.app-see-also').html(seeAlso || '').css('display', seeAlso ? '' : 'none');
            infoPane.find('.app-help').css('display', help ? '' : 'none');
        }
    }

    function toCatDef(elem) {
        var catElem = elem.closest('[data-property]'),
            name,
            scope;
        if (!catElem.length)
            catElem = elem.closest('[data-category]');
        scope = catElem.data('scope');
        name = catElem.data('category-name') || catElem.data('category');
        return propSetMap[scope][name];
    }

    function toPropDef(elem) {
        var catDef = toCatDef(elem),
            property = elem.closest('[data-property]'),
            name = (property.data('property') || ''),
            propDef = catDef;
        name.split(/_/).forEach(n =>
            propDef = propDef.properties[n]
        );
        return propDef;
    }

    function propGridDef() {
        return _touch.dataView().data('survey');
    }

    // event handlers

    $document
        .on('beforemodalcancel.app', e => {
            if (activePage().is('.app-propgrid')) {
                var focusedProp = activePage('.app-has-focus');
                if (focusedProp.length) {
                    var hasInput = !!$('.app-data-input').length;
                    _input.blur();
                    if (_input.valid()) {
                        if (hasInput)
                            focusedProp.each(function () {
                                _touch.hasFocus($(this), hasInput);
                            });
                        else
                            _touch.activePage('.app-has-focus, .app-was-focused').removeClass('app-has-focus app-was-focused');
                        _touch.scrollable('focus');
                    }
                    return false;
                }
            }
        })
        .on('vclick', '.app-propgrid [data-category] .app-toggle, .app-propgrid [data-category]', function (e) {
            var cat = $(this).closest('[data-category]'),
                categoryName = cat.data('category'),
                isCollapsed = !cat.is('.app-collapsed'),
                propElem = cat.next(),
                toggleClicked = $(e.target).is('.app-toggle'),
                lastPropElem;
            selectCategory(cat, !toggleClicked);
            startVerticalResizing(isCollapsed);
            if (toggleClicked || _touch.dblClick(cat)) {
                propCollapsed(cat.data('scope') + '$' + categoryName, isCollapsed === false ? null : isCollapsed);
                cat.toggleClass('app-collapsed', isCollapsed);
                while (propElem.length && propElem.data('category-name') === categoryName) {
                    propElem.toggleClass('app-collapsed-cat', isCollapsed);
                    if (propElem.is(':visible'))
                        lastPropElem = propElem;
                    propElem = propElem.next();
                }
                if (!isCollapsed)
                    updatePropGridLayout();
            }
            finishVerticalResizing(isCollapsed);
            if (toggleClicked)
                if (lastPropElem)
                    scrollExpandedParentIntoView(cat, lastPropElem);
                else
                    selectCategory(cat);
            return false;
        })
        .on('vclick', '.app-propgrid-title .app-close', e => {
            if (_input.valid()) {
                _touch.goBack();
                return false;
            }
        })
        .on('vclick', '.app-propgrid [data-property].app-complex .app-toggle', complexPropertyClick)
        .on('vdblclick', '.app-propgrid [data-property].app-complex:not(.app-complex-off) [data-control="label"]', complexPropertyClick)
        .on('vdblclick', '.app-propgrid [data-property] [data-control="label"]', function (e) {
            var that = $(this),
                field = _input.elementToField(that);
            if (field && field.ItemsStyle === 'DropDownList') {
                setTimeout(function () {
                    if (that.is('.app-has-focus')) {
                        $('.app-data-input').trigger('blur');
                        _touch.scrollable('focus');
                        _touch.hasFocus(that);
                    }
                }, 150);
            }
        })
        .on('datainputfocus.app', '.app-propgrid', function (e) {
            var fieldName = e.dataInput.data('field'),
                field = _input.elementToField(e.dataInput),
                dataView = field._dataView;
            _app.userVar(`${dataView._survey.context.instance}.${dataView._survey.context.propSet._registered}.lastSelected`, fieldName)
            setTimeout(updatePropertyInfo, 0, e.dataInput);
        })
        .on('setvalue.input.app', '.app-propgrid', e => {
            var field = _input.eventToField(e);
            if (!field.AllowNulls && String.isBlank(e.inputValue)) {
                e.inputValid = false;
                e.inputError = resources.Validator.RequiredField;
                return false;
            }
        })
        //.on('vclick mousedown touchend', '[data-input]', e => {
        //    if (!_input.valid())
        //        return false;
        //})
        .on('datainputlabel.app', '.app-propgrid [data-control="label"]', function (e) {
            if (!_input.valid())
                return false;
            var property = e.dataInput.closest('[data-property]');
            if (property.length) {
                _touch.hasFocus(property.find('[data-control="field"]'));
                _touch.scrollIntoView($(this));
                _touch.saveLastFocusedField(property.data('property'));
                if (e.dblClick && (!property.is('.app-complex') || property.is('.app-complex-off'))) {
                    // Let the focus to be set on the input. 
                    // This will also enable the cycling of the data - input="dropdownlist" values.
                }
                else
                    return false;
            }
        })
        .on('pageautofocus.app', '.app-propgrid', function (e) {
            // prevent the default autofocus
            if (!e.reverse)
                return false;
        })
        .on('datainputmove.app', '.app-propgrid .app-wrapper', function (e) {
            // always set the focus on the data-control="label" when Tab or Shift+Tab is pressed
            if (e.direction.match(/left|right/) || e.direction === 'down' && e.keyCode === 13) {
                var textInput = e.textInput,
                    focusedElem = textInput.closest('[data-property]');
                if (focusedElem.length) {
                    _touch.propGrid.timeout = setTimeout(() => {
                        textInput.trigger('blur');
                        _touch.scrollIntoView(focusedElem);
                        _touch.hasFocus(focusedElem.find('[data-control="field"]'));
                        _touch.scrollable('focus');
                    });
                    return false;
                }
            }
            else
                return false;
        })
        .on('keyboardnavigation.app', '.app-propgrid .app-wrapper', function (e) {
            var direction = e.direction,
                textInput = $('.app-data-input'),
                focusedElem;
            if (!textInput.length) {
                focusedElem = activePage('[data-control="label"].app-has-focus,[data-container="row"][data-category].app-has-focus');
                if (direction.match(/^(up|down|left|right|enter|tab|end|home|edit)$/)) {
                    if (direction == 'end')
                        focusedElem = activePage('[data-control="label"]:visible,[data-container="row"][data-category]:visible').last();
                    if (!focusedElem.length)
                        direction = 'home';
                    if (!focusedElem.length || direction === 'home')
                        focusedElem = activePage('[data-control="label"]:visible,[data-container="row"][data-category]:visible').first();
                    if (!focusedElem)
                        return;
                    focusedElem = focusedElem.closest('[data-container="row"]');
                    // handle "edit"
                    if (direction === 'edit')
                        if (!focusedElem.is('[data-category]')) {
                            _input.focus({ field: focusedElem.data('property') });
                            return false;
                        }
                    // handle "tab"
                    if (direction === 'tab') {
                        if (focusedElem.is('[data-category]'))
                            direction = e.originalEvent.shiftKey ? 'up' : 'down';
                        else {
                            _input.focus({ field: focusedElem.data('property') });
                            return false;
                        }
                    }
                    // handle "enter"
                    if (direction === 'enter')
                        if (focusedElem.is('.app-complex:not(.app-complex-off),[data-category]')) {
                            if (focusedElem.is('.app-collapsed')) {
                                direction = 'right';
                            }
                            else
                                direction = 'left';
                        }
                        else
                            return false;
                    // handle "left"
                    if (direction === 'left') {
                        direction = 'up';
                        if (focusedElem.is('.app-complex:not(.app-complex-off)')) {
                            if (!focusedElem.is('.app-collapsed')) {
                                complexPropertyClick.apply(focusedElem[0], {});
                                return false;
                            }
                        }
                        else if (focusedElem.is('[data-category]')) {
                            if (!focusedElem.is('.app-collapsed')) {
                                focusedElem.find('.app-toggle').trigger('vclick');
                                return false
                            }
                        }
                    }
                    // handle "right"
                    if (direction === 'right') {
                        direction = 'down';
                        if (focusedElem.is('.app-complex:not(.app-complex-off)')) {
                            if (focusedElem.is('.app-collapsed')) {
                                complexPropertyClick.apply(focusedElem[0], {});
                                return false;
                            }
                        }
                        else if (focusedElem.is('[data-category]')) {
                            if (focusedElem.is('.app-collapsed')) {
                                focusedElem.find('.app-toggle').trigger('vclick');
                                return false
                            }
                        }
                    }
                    // go "up" or "down"
                    if (direction === 'up' || direction === 'down')
                        focusedElem = direction === 'up' ? focusedElem.prevAll('[data-container="row"]:visible') : focusedElem.nextAll('[data-container="row"]:visible');
                    focusedElem = focusedElem.first();
                    if (focusedElem.length) {
                        if (focusedElem.is('[data-category]'))
                            selectCategory(focusedElem);
                        else if (focusedElem.is('[data-property]')) {
                            focusedElem = focusedElem.find('[data-control="field"]');
                            _touch.hasFocus(focusedElem);
                            _touch.saveLastFocusedField(focusedElem);
                            focusedElem.closest('[data-container="row"]');
                        }
                        _touch.scrollIntoView(focusedElem);
                    }
                    return false;
                }
            }
        })
        .on('keyboardpreview.app', '.app-propgrid .app-wrapper', function (e) {
            var activeElement = _touch.activeElement();
            if (e.originalEvent.key === 'F1' && $(this).find('[data-control="label"].app-has-focus').length) {
                activePage('.app-infopane .app-help').trigger('mousedown');
                return false;
            }
            else if (!activeElement.is(':input')) {
                activeElement = $(this).find('[data-control="label"].app-has-focus');
                if (activeElement.length) {
                    var originalEvent = e.originalEvent,
                        key = originalEvent.key || '',
                        fieldName = activeElement.data('field');
                    if (key.length === 1 && !originalEvent.ctrlKey || key.match(/Backspace|Del|Delete/)) {
                        if (key.length > 1) {
                            var field = _input.elementToField(activeElement);
                            if (field && field.AllowNulls) {
                                if (!field.isReadOnly())
                                    _input.execute({ values: [{ field: fieldName, value: null }] });
                            }
                            else
                                _input._buffer = '';
                        }
                        else
                            _input._buffer = key;
                        e.preventDefault();
                        //_touch.hasFocus(_input.of(activeElement));
                        _input.focus({ field: fieldName });
                    }
                }
            }
        })
        .on('paste', function (e) {
            var activeElement = _touch.activeElement();
            if (!activeElement.is(':input') && activePage().is('.app-propgrid')) {
                activeElement = $(this).find('[data-control="label"].app-has-focus');
                if (activeElement.length) {
                    var fieldName = activeElement.data('field'),
                        text = e.originalEvent.clipboardData.getData('text/plain');
                    //_input.execute({ values: [{ field: fieldName, value: text }] });
                    _input._buffer = text;
                    _input.focus({ fieldName: fieldName });
                    return false;
                }
            }
        })
        .on('propgridinit.app', function (e) {
            var context = e.survey.context;
            if (context._initialized)
                return;
            context._initialized = true;
            var
                page = activePage(),
                header = _touch.bar('create', { type: 'header', page: page }),
                footer = _touch.bar('create', { type: 'footer', page: page }),
                title = context.text ? $div('app-propgrid-title').appendTo(header).text(context.text) : null,
                topNav = context.nodes ? $div('app-top-nav').appendTo(header) : null,
                toolbar = $div('app-toolbar app-toolbar-props').appendTo(header),
                infoPane = $div('app-infopane app-has-scrollbars').appendTo(footer).attr('data-context-menu', true),
                paneTitle = $div('app-title').appendTo(infoPane);

            if (title && context.icon)
                _touch.icon(context.icon, title);

            var navToolbar = $div('app-toolbar app-toolbar-nav').insertAfter(title);

            var refreshButton = $span('app-btn').appendTo(navToolbar).attr({ title: resources.Pager.Refresh, 'data-pg-action': 'propgrid.refresh' });
            _touch.icon('material-icon-refresh', refreshButton);
            var collapseAllButton = $span('app-btn').appendTo(navToolbar).attr({ title: resources.PropGrid.CollapseAll, 'data-pg-action': 'propgrid.collapse-all' });
            _touch.icon('material-icon-unfold-less', collapseAllButton);
            var propertiesButton = $span('app-btn').appendTo(navToolbar).attr({ title: resources.PropGrid.Properties, 'data-pg-action': 'propgrid.properties' });
            _touch.icon('material-icon-handyman', propertiesButton);
            var pinButton = $span('app-btn').appendTo(navToolbar).attr({ title: resources.PropGrid.Pin, 'data-pg-action': 'propgrid.pin' });
            _touch.icon('material-icon-push-pin', pinButton);

            $span('app-text').appendTo(paneTitle);
            _touch.icon('material-icon-close', $span('app-close').appendTo(title).attr('data-title', resources.ModalPopup.Close));
            $div('app-description').appendTo(infoPane);
            $div('app-see-also').appendTo(infoPane);
            if (propGridDef().helpUrl)
                _touch.icon('material-icon-help_outline', paneTitle).addClass('app-help').attr({ title: Web.MembershipResources.Bar.HelpLink, 'data-tooltip-location': 'above' }).hide();
            var categorizedButton = $span('app-btn').appendTo(toolbar).toggleClass('app-selected', true).attr({ title: resources.PropGrid.Categorized, 'data-pg-action': 'propgrid.categorized' });
            _touch.icon('material-icon-category', categorizedButton);
            var alphabeticalButton = $span('app-btn').appendTo(toolbar).toggleClass('app-selected', false).attr({ title: resources.PropGrid.Alphabetical, 'data-pg-action': 'propgrid.alphabetical' });
            _touch.icon('material-icon-sort_by_alpha', alphabeticalButton);
            _touch.bar('show', header);
            _touch.bar('show', infoPane);
            page.data('infoPane', infoPane);
            $div().attr('data-draggable', 'propgrid-infopane').insertBefore(infoPane);

            if (topNav) {
                _touch.treeView({
                    container: topNav,
                    type: context.instance,
                    nodes: context.nodes
                });
                $div().attr('data-draggable', 'propgrid-topnav').insertAfter(topNav);
            }
            // customize the height and width of the components
            var topNavHeight = propGridComponentProperty('topNav.height', null);
            if (topNavHeight)
                topNav.css({ height: topNavHeight, minHeight: topNavHeight, maxHeight: topNavHeight });
            var infoPaneHeight = propGridComponentProperty('infoPane.height', context.instance);
            if (infoPaneHeight)
                infoPane.css({ height: infoPaneHeight, minHeight: infoPaneHeight, maxHeight: infoPaneHeight });
            $div().attr('data-draggable', 'propgrid-resizer').insertAfter(header);
            _touch.resetPageHeight();
            _touch.whenPageShown(verifyPropGridLayout);
        })
        .on('propgridcalc.app', function (e) {
            var dataView = e.dataView;

            //if (!validateInput(dataView))
            //    return;

            // TODO: 
            // Handle the validation with the possible fetching of additional resources.
            // The rules must be defined on the "type" level.


            var survey = e.survey;
            var context = survey.context;
            var targetObj = context.target || {};
            var data = dataView.data('modified');
            var changeLog = [];
            var changedValues = [];


            if (typeof targetObj != 'object') {
                _touch.notify(`The value of the target is not an object:\n${targetObj}`);
                return;
            }

            var confirmProp;

            for (var key in data._modified) {
                var propDef = context.propMap[key];
                if (propDef.confirm) {
                    confirmProp = propDef;
                    break;
                }
            }

            if (confirmProp) {
                var confirmText = _app.eval(confirmProp.confirm, data);
                if (confirmText) {
                    if (survey._userConfirmed)
                        delete survey._userConfirmed;
                    else {
                        $app.confirm(confirmText)
                            .then(() => {
                                survey._userConfirmed = true;
                                setTimeout(_ => {
                                    $(document).trigger(e);
                                });
                            })
                            .fail(() => {
                                _touch.activeElement('blur');
                                var values = [];
                                for (var field in data._modified) {
                                    values.push({ field, value: data._modified[field] });
                                }
                                _input.execute(values);
                            });
                        return;
                    }
                }
            }

            targetObj._changed = function (field) {
                if (field instanceof RegExp) {
                    var propMap = context.propMap;
                    for (var key in propMap) {
                        var propDef = propMap[key];
                        if (propDef.propName.match(field))
                            changeLog.push(propDef.propName);
                    }
                }
                else
                    changeLog.push(field.replace(/\./g, '_'));
            };
            canEvaluate(targetObj, true);

            var restoreValues = [];
            var finishList = [];

            for (var key in data._modified) {
                var propDef = context.propMap[key];
                var newValue = data[key];
                if (newValue == null && ('default' in propDef)) {
                    newValue = propDef.default;
                    if (data._modified[key] == newValue) {
                        restoreValues.push({ field: key, value: newValue });
                        continue;
                    }
                }
                if (propDef?.parent?.compound) {
                    var compoundValue = calculateCompoundValue(propDef.parent, null, context.propMap, data);
                    if (data[propDef.parent.name] != compoundValue)
                        restoreValues.push({ field: propDef.parent.name, value: compoundValue });
                }
                if (propDef.virtual) {
                    if (propDef.finish)
                        finishList.push(propDef);
                    if (propDef.set)
                        evaluateProperty(propDef, targetObj, newValue);
                    var virtualField = dataView.findField(propDef.propName);
                    if (virtualField)
                        dataView._originalRow[virtualField.Index] = newValue; // the new value of the virual field becomes its "original" value
                }
                else {
                    evaluateProperty(propDef, targetObj, newValue);
                    targetObj._changed(key);
                }
            }
            if (restoreValues.length) {
                restoreValues.forEach(fv => {
                    var field = dataView.findField(fv.field);
                    dataView._editRow[field.OriginalIndex] = fv.value;
                });
                _app.input.execute({ values: restoreValues });
            }

            if (changeLog.length) {
                var patch = { _map: {} };
                var infoPaneChanged;
                canEvaluate(patch, true);
                changeLog.forEach(field => {
                    var propDef = context.propMap[field];
                    if (!propDef)
                        throw new Error(`Unknown property '${field}' is specified in the change log.`)
                    var newValue = evaluateProperty(propDef, targetObj);
                    //if (propDef.select)
                    //    propertySetter.call(patch, propDef.select, newValue);
                    //else
                    //    patch[field] = newValue;
                    evaluateProperty(propDef, patch, newValue);
                    patch._map[field] = propDef;
                    if (propDef.seeAlso)
                        infoPaneChanged = true;
                });

                // evaluate the patch to see if other properties were changed
                for (var key in patch._map) {
                    var propDef = patch._map[key];
                    var dataValue = data[propDef.propName];
                    var patchValue = evaluateProperty(propDef, patch);
                    if (dataValue !== patchValue) {
                        if (patchValue == null)
                            patchValue = propDef.default;
                        changedValues.push({ field: key, value: patchValue })
                    }
                }

                canEvaluate(patch, false);

                // send the patchData for processing with the timeout to accumulate multiple changes
                clearTimeout(dataView._studioPatchTimeout);
                dataView._studioPatchTimeout = setTimeout(triggerPropGridEvent, 100, 'edit', { patch, data, context, infoPaneChanged });

                // broadcast the changes to the property grid
                if (changedValues.length) {
                    _app.input.execute({ values: changedValues });
                }

                // execute the 'finish' scripts on the targetObj instance
                for (var key in patch._map) {
                    var propDef = patch._map[key];
                    if (propDef.finish)
                        finishList.push(propDef);
                }

            }
            canEvaluate(targetObj, false);

            _touch.activePage('.app-complex-on-demand').each(updateComplexityOnDemand);
            clearTimeout(dataView._studioFinishTimeout);
            if (finishList.length)
                dataView._studioFinishTimeout = setTimeout(propGridCalcFinish, 0, finishList, targetObj);
            return false;
        })
        .on('mousedown pointerdown touchstart', '.app-propgrid .app-infopane .app-help', function (e) {
            var propDef = toPropDef(activePage('[data-property] .app-has-focus'));
            //helpUrl = propGridDef().helpUrl + '?topic=',
            //    path = [],
            //    scope;
            if (propDef/* && helpUrl*/) {
                //if (!helpUrl.endsWith('/'))
                //    helpUrl = helpUrl += '/';
                //while (propDef) {
                //    if (propDef.parent) {
                //        path.splice(0, 0, propDef.name)
                //        //if (propDef.parent.parent)
                //        //    url.splice(0, 0, '.');
                //        propDef = propDef.parent;
                //    }
                //    else {
                //        //url.splice(0, 0, propDef.scope/*, '/'*/);
                //        scope = propDef.scope;
                //        break;
                //    }
                //}
                //url.splice(0, 0, helpUrl);
                //url = url.join('').toLowerCase();
                //_touch.notify({ text: url, force: true });
                var dataView = _touch.dataView();
                triggerPropGridEvent('help', { path: _touch.propGrid.toPropPath(propDef), data: dataView.data(), context: dataView._survey.context.target });
                //window.open(url, 'propgridhelp_' + propGridDef().context.replace(/\W/g, '_'));
            }
            return false;
        })
        .on('resized.app', verifyPropGridLayout)
        .on('dblclick', '[data-draggable="propgrid-topnav"]', e => {
            $(e.target).prev().css({ height: '', minHeight: '', maxHeight: '' });
            _touch.resetPageHeight();
            propGridComponentProperty('topNav.height', null, null);
            return false;
        })
        .on('dblclick', '[data-draggable="propgrid-infopane"]', e => {
            var draggable = $(e.target);
            var infoPane = draggable.next();
            var originalHeight = infoPane.height();
            infoPane.css({ height: '', minHeight: '', maxHeight: '' });
            var height = 'auto';
            var maxHeight = 'none';
            var minHeight = 'none';
            var newHeight = null; // reset the user-defined height
            var hasScrolling = infoPane[0].offsetHeight != infoPane[0].scrollHeight;
            infoPane.css({ height, minHeight, maxHeight });
            _touch.resetPageHeight();

            var infoPaneRect = _app.clientRect(infoPane);
            var scrollableRect = _app.clientRect(_touch.scrollable());
            if (infoPaneRect.top <= scrollableRect.bottom) {
                infoPane.css({ height: '', minHeight: '', maxHeight: '' });
                _touch.resetPageHeight();
            }
            else if (hasScrolling) {
                newHeight = infoPane.height(); // memorize the new height
                if (newHeight === originalHeight) {
                    newHeight = null;
                    infoPane.css({ height: '', minHeight: '', maxHeight: '' });
                }
            }

            if (newHeight == null)
                height = '';
            else
                height = infoPane.height();
            minHeight = height;
            maxHeight = height;
            infoPane.css({ height, minHeight, maxHeight });

            propGridComponentProperty('infoPane.height', null, newHeight);
            _touch.resetPageHeight();

            return false;
        })
        .on('dblclick', '[data-draggable="propgrid-divider"]', e => {
            propGridComponentProperty('divider.x', null, null);
            var selectedItem = activePage('.app-treeview .app-selected:first').removeClass('app-selected');
            selectedItem.find('>.app-node').trigger('vclick');
            return false;
        })
        .on('dblclick', '[data-draggable="propgrid-resizer"]', e => {
            propGridComponentProperty('width', null, null);
            var page = activePage();
            var newWidth = _touch.toWidth('xxs');
            var dividerX = propGridComponentProperty('divider.x', null);
            page.removeData('modalWidth');
            resizePropGrid(page, null, newWidth, null, dividerX ? (newWidth / _app.clientRect(page).width * dividerX) : null);
            return false;
        })
        .on('vclick', '.app-propgrid [data-container="row"]', e => {
            if (!e.isDefaultPrevented()) {
                var labelControl = $(e.target).prev().find('[data-control="label"]');
                if (!labelControl.is('.app-has-focus')) {
                    labelControl.trigger('vclick');
                    return false;
                }
            }
        })
        .on('vclick', '.app-propgrid [data-input="none"]', e => {
            var property = $(e.target).closest('[data-container="row"]'),
                labelControl = property.find('[data-control="label"]'),
                handled;
            if (!labelControl.is('.app-has-focus')) {
                labelControl.trigger('vclick');
                handled = true;
            }
            if (_touch.dblClick(property) && property.is('.app-complex')) {
                property.find('.app-toggle').trigger('vclick');
                handled = true;
            }
            if (handled)
                return false;
        })
        .on('vclick', '.app-propgrid [data-pg-action]', e => {
            var button = $(e.target).closest('[data-pg-action]'),
                action = button.attr('data-pg-action');
            if (!button.is('.app-disabled'))
                setTimeout(triggerPropGridEvent, 0, 'action', { action, button });
            return false;
        })
        .on('treeview.app', e => {
            if (e.treeView.eventName === 'select') {
                var propGrid = triggerPropGridEvent('fetch').propGrid,
                    result = propGrid.result;
                if (!result) {
                    // TODO: implement the fetch by default 
                    return;
                }
                result
                    .then(data => {
                        var context = propGridContext();
                        var propSet = data[0];
                        var target = data[1];
                        // analyze the displayObj and enlist the property scopes
                        $app.touch.propGrid('show', {
                            instance: context.instance,// 'studio.settings',
                            //text: 'Settings',
                            //icon: 'material-icon-settings',
                            //nodes: fetchHierarchy(`/v2/studio/hierarchies/settings/definition`),
                            propSet,
                            target
                            //helpUrl: 'https://codeontime.com/roadmap/v9',
                            //location: 'left'
                        });
                        //notifyIncompleteImplementation('settings');
                    });
            }
        })
        .on('propgrid.app', e => {
            if (!e.isDefaultPrevented() && e.propGrid.eventName === 'action') {
                switch (e.propGrid.action) {
                    case 'propgrid.properties':
                        _touch.scrollIntoView(_touch.activePage('.app-treeview .app-selected:first > .app-node'), 'center');
                        _touch.scrollable('focus');
                        break;
                    case 'propgrid.collapse-all':
                        var selected = _touch.activePage('.app-treeview .app-selected:first');
                        var parents = selected.parents('li');
                        if (parents.length)
                            selected = parents.last();
                        _touch.activePage('.app-treeview .app-selected').removeClass('app-selected');
                        _touch.activePage('.app-treeview .app-expanded').removeClass('app-expanded').addClass('app-collapsed');
                        selected.find('>.app-node').trigger('vclick');
                        if (selected.length)
                            selected[0].scrollIntoView({ block: 'center', behavior: 'instant' });
                        //var context = _touch.dataView()._survey.context;
                        //$app.touch.propGrid('show', {
                        //    instance: context.instance,
                        //    target: {},
                        //    propSet: null,
                        //});
                        break;
                    case 'propgrid.refresh':
                        _touch.activePage('.app-treeview .app-selected').removeClass('app-selected');
                        _touch.activePage('.app-treeview .app-expanded').removeClass('app-expanded').addClass('app-collapsed');
                        _touch.propGrid('show', {
                            instance: propGridContext().instance
                        });
                        _touch.treeView({
                            treeView: e.treeView.treeView
                        });
                        break;
                    default:
                        _touch.notify(e.propGrid.action);
                        break;
                }
                updateNavToolbar();
                return false;
            }
        });

    /* Drag & Drop */

    _app.dragMan['propgrid-topnav'] = {
        options: {
            taphold: false,
            immediate: false
        },
        start: function (drag) {
            var that = this,
                target = drag.target,
                rect;
            rect = _app.clientRect(target);
            drag.dir = 'all';

            that._target = target.addClass('app-dragging');
            that._deltaY = rect.top - drag.y;

            var topNav = activePage('.app-bar-header .app-top-nav');
            var topNavRect = _app.clientRect(topNav);
            var scrollable = _touch.scrollable();
            var scrollableRect = _app.clientRect(scrollable);

            that._topNav = topNav;
            that._topNavHeight = topNav.height();
            that._minY = drag.y - Math.ceil(topNavRect.height - (_touch.settings('ui.propGrid.minTopNavHeight') || 80) + 1);
            that._maxY = Math.ceil(topNavRect.bottom + (scrollableRect.height - propGridMinHeight())) - 1;

            _input.blur();
        },
        move: function (drag) {
            var that = this;
            var newY = drag.y + that._deltaY;

            if (newY < that._minY)
                that._newY = newY;
            if (newY > that._maxY)
                newY = that._maxY;

            if (newY != that._newY) {
                that._newY = newY;
                that._position();
            }
        },
        cancel: function (drag) {
            var that = this;
            that._target.removeClass('app-dragging');
            delete that._target;
            if (that._topNavHeight)
                that._position(that._topNavHeight);
            delete this._topNav;
            _touch.scrollable('refresh');
        },
        end: function (drag) {
            propGridComponentProperty('topNav.height', null, this._topNav.height());
            delete this._topNavHeight;
            this.cancel();
        },
        _position: function (originalHeight) {
            var topNav = this._topNav;
            var topNavRect = _app.clientRect(topNav);
            var height = originalHeight || Math.ceil(topNavRect.height + (this._newY - topNavRect.bottom));

            topNav.css({
                height,
                maxHeight: height,
                minHeight: height
            });
            _touch.resetPageHeight();
        }
    };

    _app.dragMan['propgrid-infopane'] = {
        options: {
            taphold: false,
            immediate: false
        },
        start: function (drag) {
            var that = this,
                target = drag.target,
                rect;
            rect = _app.clientRect(target);
            drag.dir = 'all';

            that._target = target.addClass('app-dragging');
            that._deltaY = rect.top - drag.y;

            var infoPane = activePage('.app-bar-footer .app-infopane');
            var infoPaneRect = _app.clientRect(infoPane);
            var scrollable = _touch.scrollable();
            var scrollableRect = _app.clientRect(scrollable);

            that._infoPane = infoPane;
            that._infoPaneHeight = infoPane.height();
            that._minY = infoPaneRect.top - Math.ceil(scrollableRect.height - propGridMinHeight() + 1);
            that._maxY = Math.ceil(infoPaneRect.bottom - (_touch.settings('ui.propGrid.minInfoPaneHeight') || 50));
            that._padding = Math.floor(parseFloat(infoPane.css('padding-bottom')) + parseFloat(infoPane.css('padding-top')));

            _input.blur();
        },
        move: function (drag) {
            var that = this;
            var newY = drag.y + that._deltaY;

            if (newY < that._minY)
                newY = that._newY;
            if (newY > that._maxY)
                newY = that._maxY;


            if (newY != that._newY) {
                that._newY = newY;
                that._position();
            }
        },
        cancel: function (drag) {
            var that = this;
            that._target.removeClass('app-dragging');
            delete that._target;
            if (that._infoPaneHeight)
                that._position(that._infoPaneHeight);
            delete that._infoPane;
            _touch.scrollable('refresh');
        },
        end: function (drag) {
            propGridComponentProperty('infoPane.height', null, this._infoPane.height());
            delete this._infoPaneHeight;
            this.cancel();
        },
        _position: function (originalHeight) {
            var infoPane = this._infoPane;
            var infoPaneRect = _app.clientRect(infoPane);
            var height = originalHeight || Math.ceil(infoPaneRect.height + (infoPaneRect.top - this._newY) - this._padding);

            infoPane.css({
                height,
                maxHeight: height,
                minHeight: height
            });
            _touch.resetPageHeight();
        }
    };

    _app.dragMan['propgrid-divider'] = {
        options: {
            taphold: false,
            immediate: false
        },
        start: function (drag) {
            var that = this,
                target = drag.target,
                rect,
                rect = _app.clientRect(target);
            drag.dir = 'all';

            // adding 7 will compensate the alingment of the divider to match the vertical line with the focused  label
            that._deltaX = rect.left - drag.x + 7;

            var form = target.closest('[data-layout="form"]');
            var formRect = that._formRect = _app.clientRect(form);

            that._x = parseInt(target.css('left'));
            that._minX = formRect.left + propGridMinDividerX() - 1;
            that._maxX = formRect.right - propGridMinDividerX() - 7;
            that._dividers = form.find('[data-draggable="propgrid-divider"]');

            _input.blur();
        },
        move: function (drag) {
            var that = this;
            var newX = Math.round(drag.x + that._deltaX);
            if (newX < that._minX)
                newX = that._minX;
            if (newX > that._maxX)
                newX = that._maxX;
            newX = newX - that._formRect.left + 1;
            if (newX != that._newX)
                that._position(newX);
        },
        cancel: function (drag) {
            var that = this;
            if (that._x != null)
                that._position(that._x);
            delete that._target;
            delete that._dividers;
        },
        end: function (drag) {
            propGridComponentProperty('divider.x', null, this._newX);
            delete this._x;
            this.cancel();
        },
        _position: function (x) {
            var that = this;
            that._newX = x;
            resizePropGridDivider(that._dividers, that._formRect.width, x);
        }
    };

    _app.dragMan['propgrid-resizer'] = {
        options: {
            taphold: false,
            immediate: false
        },
        start: function (drag) {
            var that = this,
                target = drag.target,
                rect,
                rect = _app.clientRect(target);
            drag.dir = 'all';

            // adding 7 will compensate the alignment of the divider to match the vertical line with the focused label
            that._target = target;
            target.addClass('app-dragging');

            var page = that._page = target.closest('.ui-page');
            that._location = page.is('.app-page-modal-dock-left') ? 'left' : 'right';
            that._width = parseInt(page.css('min-width'));
            that._availWidth = $(window).width();
            that._minX = propGridMinDividerX() * 2;
            that._maxX = that._availWidth - that._minX;
            that._deltaX = rect.left - drag.x + (that._location === 'left' ? rect.width : 0);
            var dividers = that._dividers = page.find('[data-draggable="propgrid-divider"]');
            if (dividers.length)
                that._dividerX = parseInt(that._dividers[0].style.left);
            _input.blur();
        },
        move: function (drag) {
            var that = this;
            var newX = Math.round(drag.x + that._deltaX);
            if (newX < that._minX)
                newX = that._minX;
            if (newX > that._maxX)
                newX = that._maxX;
            var newWidth = that._location === 'left' ? newX : that._availWidth - newX + 1;
            if (newWidth != that._newWidth)
                that._position(newWidth);
        },
        cancel: function (drag) {
            var that = this;
            if (that._width != null)
                that._position(that._width);
            that._target.removeClass('app-dragging');
            delete that._target;
            delete that._dividers;
            delete that._page;
        },
        end: function (drag) {
            var that = this;
            propGridComponentProperty('width', null, that._newWidth);
            if (that._dividers.length) {
                var newDividerX = parseInt(that._dividers[0].style.left);
                propGridComponentProperty('divider.x', null, Math.abs(newDividerX - that._newWidth / 2) > 1 ? newDividerX : null);
            }
            delete that._width;
            that.cancel();
        },
        _position: function (newWidth) {
            var that = this;
            that._newWidth = newWidth;
            //    that._page.css({ minWidth: newWidth, maxWidth: newWidth, width: newWidth }).data('modalWidth', newWidth);
            //    _touch.resetPageHeight(that._page);
            //    if (that._dividers.length) {
            //        var pageWidth = parseInt(that._page[0].style.minWidth);
            //        var dividerX = Math.max(Math.ceil(that._dividerX * (pageWidth / that._width)), propGridMinDividerX());
            //        if (pageWidth - dividerX < propGridMinDividerX())
            //            dividerX = pageWidth - propGridMinDividerX();
            //        resizePropGridDivider(that._dividers, pageWidth, dividerX);
            //    }
            resizePropGrid(that._page, that._dividers, newWidth, that._width, that._dividerX);
        }
    };

    function resizePropGrid(page, dividers, newWidth, width, dividerX) {
        if (width == null)
            width = newWidth;
        if (dividerX == null)
            dividerX = Math.ceil(width / 2);
        page.css({ minWidth: newWidth, maxWidth: newWidth, width: newWidth }).data('modalWidth', newWidth);
        _touch.resetPageHeight(page);
        if (!dividers)
            dividers = activePage('[data-draggable="propgrid-divider"]');
        if (dividers.length) {
            var pageWidth = parseInt(page[0].style.minWidth);
            var newDividerX = Math.max(Math.ceil(dividerX * (pageWidth / width)), propGridMinDividerX());
            if (pageWidth - newDividerX < propGridMinDividerX())
                newDividerX = pageWidth - propGridMinDividerX() - 7;
            resizePropGridDivider(dividers, pageWidth, newDividerX);
        }
    }

    function resizePropGridDivider(dividers, formWidth, x) {
        var labelWdith = x + 'px',
            fieldWidth = (formWidth - x - 7) + 'px';
        dividers.each(function (divider) {
            this.style.left = x + 'px';
            var el = this.nextSibling;
            while (el) {
                switch (el.getAttribute && el.getAttribute('data-control')) {
                    case 'label':
                        el.style.maxWidth = labelWdith;
                        el.style.minWidth = labelWdith;
                        el.style.width = labelWdith;
                        break;
                    case 'field':
                        el.style.maxWidth = fieldWidth;
                        el.style.minWidth = fieldWidth;
                        el.style.width = fieldWidth;
                        break;
                }
                el = el.nextSibling;
            }
        });

    }

    /* Utilities */

    function triggerPropGridEvent(eventName, options) {
        var treeView = _touch.treeView.context ? _touch.treeView.context(activePage('.app-treeview .app-selected')) : {};
        var propGrid = {
            eventName
        };
        for (var key in options)
            propGrid[key] = options[key];
        var e = $.Event('propgrid.app',
            {
                propGrid,
                treeView
            });
        $(document).trigger(e);
        if (propGrid.infoPaneChanged)
            updatePropertyInfo(activePage('[data-property] .app-has-focus:first'));
        return e;
    }

    function noOp() {

    }
    function canEvaluate(obj, canEvaluate) {
        if (canEvaluate) {
            obj._get = propertyGetter;
            obj._set = propertySetter;
            obj._tagged = propertyTagged;
            if (!obj._changed)
                obj._changed = noOp;
            obj._context = _touch.propGrid.data;
        }
        else {
            delete obj._get;
            delete obj._set;
            delete obj._changed;
            delete obj._context;
            delete obj._tagged;
            delete obj._tagList;
        }
    }

    function propertySetter(selector, value) {
        if (arguments.length != 2)
            throw new Error('The property setter expects the "selector" and "value" parameters.');
        var obj = this;
        selector = selector.split(/\./g);
        selector.forEach((key, index) => {
            if (index == selector.length - 1)
                obj[key] = value;
            else {
                var nextObj = obj[key];
                if (!nextObj)
                    nextObj = obj[key] = {};
                obj = nextObj;
            }
        });
    }

    function propertyGetter(selector) {
        if (arguments.length != 1)
            throw new Error('The property getter expects the "selector" parameter only.');
        var obj = this;
        var result = null;
        selector = selector.split(/\./g);
        selector.every((key, index) => {
            if (index == selector.length - 1)
                result = obj[key];
            else {
                obj = obj[key];
                if (obj != null)
                    return true;

            }
        });
        return result;
    }

    _touch.propGrid.toPropPath = function (propDef) {
        var propPath = [];
        var pd = propDef;
        while (pd) {
            propPath.splice(0, 0, pd.name);
            if (pd.parent) {
                propPath.splice(0, 0, '.');
                pd = pd.parent;
            }
            else {
                propPath.splice(0, 0, pd.scope + '://');
                pd = null;
            }
        }
        return propPath.join('');
    }

    function evaluateProperty(propDef, targetObj, propSetValue) {
        try {
            if (arguments.length == 2) {
                if (propDef.get)
                    return _app.eval(propDef.get, targetObj);
                if (propDef.select)
                    return propertyGetter.call(targetObj, propDef.select)
                return targetObj[propDef.propName];
            }
            else {
                if (propDef.set)
                    _app.eval(propDef.set, targetObj, propSetValue);
                else if (propDef.select)
                    propertySetter.call(targetObj, propDef.select, propSetValue);
                else
                    targetObj[propDef.propName] = propSetValue;
            }
        } catch (ex) {
            throw Error(
                (arguments.length == 2 ?
                    `Unabled to evaluate the "getter" of the ${_touch.propGrid.toPropPath(propDef)} property: ${propDef.get}` :
                    `Unabled to evaluate the "setter" of the ${_touch.propGrid.toPropPath(propDef)} property: ${propDef.set}`)
                + '\nError: ' + ex.message
            );
        }
    }

    function updatePropertyInfo(property) {
        if (!$(property).length) {
            updateInfoPane();
            return;
        }
        var propDef = toPropDef(property),
            parentPropDef = propDef.parent,
            propDisplayPath = [propDef.text],
            seeAlso = [],
            seeAlsoExpressions = propDef.seeAlso;
        while (parentPropDef) {
            if (parentPropDef.parent || parentPropDef.name != 'misc')
                propDisplayPath.splice(0, 0, parentPropDef.text);
            parentPropDef = parentPropDef.parent;
        }
        if (seeAlsoExpressions) {
            if (typeof seeAlsoExpressions == 'string')
                seeAlsoExpressions = [seeAlsoExpressions];
            var targetObj = $app.touch.dataView()._survey.context?.target || {};
            seeAlsoExpressions.forEach(expr => {
                var text = $app.eval(expr, targetObj);
                if (text != null) {
                    if (!seeAlso.length) {
                        seeAlso.push(`<b>${resources.Menu.SeeAlso}</b>`);
                        seeAlso.push('<ul>');
                    }
                    seeAlso.push('<li>', text, '</li>');
                }
            });
            if (seeAlso.length)
                seeAlso.push('</ul>')
        }
        updateInfoPane(propDisplayPath.join(' / '), propDef.hint, true, seeAlso.join(''));
    }

    function propGridComponentProperty(propName, instance, value) {
        if (!instance)
            instance = propGridContext().instance;
        propName = `propGrid.${instance}.${propName}`;
        if (arguments.length == 2)
            return _app.userVar(propName);
        _app.userVar(propName, value);
    }

    function verifyPropGridLayout() {
        var page = activePage();
        if (page.is('.app-propgrid')) {
            var pageRect = _app.clientRect(page);
            var maxPageWidth = $(window).width() - propGridMinDividerX() * 2;
            if (pageRect.width > maxPageWidth)
                resizePropGrid(page, null, maxPageWidth);
            var scrollable = page.find('.app-wrapper');
            var scrollableRect = _app.clientRect(scrollable);
            var infoPane = page.find('.app-infopane');
            var infoPaneRect = _app.clientRect(infoPane);
            if (infoPaneRect.top < scrollableRect.bottom) {
                infoPane.css({ height: '', minHeight: '', maxHeight: '' });
                propGridComponentProperty('infoPane.height', null, null);
                _touch.resetPageHeight();
            }
            var topNav = page.find('.app-top-nav');
            var topNavRect = _app.clientRect(topNav);
            if (topNavRect.top < 0 || topNavRect.height >= window.innerHeight || scrollableRect.bottom > window.innerHeight || scrollableRect.height < propGridMinHeight()) {
                topNav.css({ height: '', minHeight: '', maxHeight: '' });
                propGridComponentProperty('topNav.height', null, null);
                _touch.resetPageHeight();
            }
            _touch.scrollable('refresh');
        }
    }

    function propGridMinHeight() {
        return _touch.settings('ui.propGrid.minHeight') || 100;
    }

    function propGridMinDividerX() {
        return _touch.settings('ui.propGrid.minDividerX') || 75;
    }

    function propGridCalcFinish(finishList, targetObj) {
        if (activePage().is('.app-propgrid'))
            finishList.forEach(propDef =>
                _app.eval(propDef.finish, targetObj)
            );
    }
    function scrollExpandedParentIntoView(expandedProp, lastProp) {
        var scrollableRect = _app.clientRect(_touch.scrollable(lastProp));
        var lastPropRect = _app.clientRect(lastProp);
        if (lastPropRect.bottom > scrollableRect.bottom) {

            var expandedPropRect = _app.clientRect(expandedProp);
            var deltaY = expandedPropRect.height;

            var target = expandedProp;
            var elem = expandedProp.next();

            while (elem.length) {
                var elemRect = _app.clientRect(elem);
                deltaY += elemRect.height;
                if (deltaY > scrollableRect.height)
                    break;
                else if (elemRect.height)
                    target = elem;
                if (elem.is(lastProp))
                    break;
                elem = elem.next();
            }
            if (target.length && !expandedProp.data('navigating'))
                setTimeout(() => {
                    target[0].scrollIntoView({ block: 'end', behavior: 'smooth' })
                }, 32);
        }
    }

    function propGridContext() {
        return _touch.dataView()._survey.context;
    }

    function calculateCompoundValue(propDef, q, propMap, values) {
        if (propDef.compound) {
            var valueList = [];
            var defaultList = []
            // calcualte the 
            propDef.compound.forEach(childPropName => {
                var fieldName = propDef.name + '_' + childPropName;
                var childProp = propMap[fieldName];
                var fieldValue = values[fieldName];
                if (fieldValue != null) {
                    if (childProp.type === 'bool') {
                        if (fieldValue)
                            valueList.push(childProp.text);
                    }
                    else
                        valueList.push(fieldValue);
                }
                if (childProp) {
                    if (childProp.type === 'bool') {
                        if (childProp.default)
                            defaultList.push(childProp.text);
                    }
                    else if (childProp.default != null)
                        defaultList.push(childProp.default);
                }
            });
            var newValue = valueList.join(', ');
            if (q) {
                values[propDef.name] = newValue;
                q.default = propDef.default = defaultList.length ? defaultList.join(', ') : null;
            }
            return newValue;
        }
    }

    function propertyTagged(tags, addRemoveFlag) {
        var tagList = this._tagList;
        if (!tagList)
            tagList = this._tagList = toTagList(this['tags']);
        var result;
        if (tags instanceof RegExp) {
            tagList.every(t => {
                result = t.match(tags);
                return result == null;
            });
            if (!result)
                result = {};
        }
        else {
            var changed;
            tags.trim().split(/\s*,\s*/g).every(tagExpression => {
                if (arguments.length == 2)
                    tagExpression = (addRemoveFlag ? '+' : '-') + ' ' + tagExpression;
                var addRemove = tagExpression.match(/^\s*(\+|\-)\s*(.+)$/);
                if (addRemove) {
                    if (addRemove[1] === '+') {
                        var index = tagList.indexOf(addRemove[2]);
                        if (index === -1) {
                            tagList.push(addRemove[2]);
                            changed = true;
                        }
                    }
                    else {
                        var index = tagList.indexOf(addRemove[2]);
                        while (index >= 0) {
                            tagList.splice(index, 1);
                            changed = true;
                            index = tagList.indexOf(addRemove[2]);
                        }
                    }
                }
                else
                    result = tagList.indexOf(tagExpression) !== -1;

                return result == null;
            });
            if (changed) {
                this['tags'] = tagList.join(' ');
                this._changed('tags');
            }
        }
        return result;
    }

    function toTagList(tags) {
        if (tags == null)
            tags = [];
        else if (typeof tags == 'string')
            tags = (tags || '').replace(/,/g, ' ').split(/\s+/g);
        return tags;
    }

})();