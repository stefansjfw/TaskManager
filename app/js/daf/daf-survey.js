/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Data Aquarium Framework - Survey
* Copyright 2008-2023 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/
(function () {

    var _app = $app,
        _touch = _app.touch,
        _window = window,
        $document = $(document),
        _web = _window.Web,
        _Sys = Sys,
        currentCulture = _Sys.CultureInfo.CurrentCulture,
        dateTimeFormat = currentCulture.dateTimeFormat,
        resources = _web.DataViewResources,
        resourcesData = Web.DataViewResources.Data,
        resourcesDataFilters = resourcesData.Filters,
        resourcesDataFiltersLabels = resourcesDataFilters.Labels,
        resourcesHeaderFilter = resources.HeaderFilter,
        resourcesModalPopup = resources.ModalPopup,
        resourcesPager = resources.Pager,
        resourcesMobile = resources.Mobile,
        resourcesFiles = resourcesMobile.Files,
        resourcesValidator = resources.Validator,
        resourcesActionsScopes = resources.Actions.Scopes,
        resourcesGrid = resources.Grid,
        resourcesODP = resources.ODP,
        resourcesEditor = resources.Editor,
        labelSearch = resourcesGrid.PerformAdvancedSearch,
        labelClear = resourcesDataFiltersLabels.Clear,
        labelNullValueInForms = resourcesData.NullValueInForms,
        labelNullValue = resourcesData.NullValue,
        labelAnd = resourcesDataFiltersLabels.And,
        findDataView = _app.findDataView,
        appBaseUrl = __baseUrl,
        appServicePath = __servicePath;

    _app.survey = function (method, options) {
        if (typeof method != 'string') {
            options = arguments[0];
            method = 'show';
        }

        var originalControllerName = options.controller || 'survey',
            originalControllerInfo = originalControllerName.match(/^(.+?)((.\[min\])?\.js)?$/),
            controller = originalControllerInfo[1].replace(/\W/g, '_'),
            tags,
            values = options.values || options.data,
            data,
            dataKey;

        if (originalControllerInfo[2]) {
            var existingControllerDef = _app.survey.library[originalControllerInfo[1] + '.js'];
            if (!existingControllerDef) {
                _app.getScript('~/js/surveys/' + options.controller, { also: options.also }).then(function () {
                    existingControllerDef = _app.survey.library[originalControllerInfo[1] + '.js']
                    if (existingControllerDef)
                        _app.survey.library[controller] = existingControllerDef;
                    else
                        throw new Error('Unable to load ' + originalControllerName + ' script. Make sure to assign the survey defintion to the $app.survey.library[\'' + originalControllerInfo[1] + '.js\'] entry.');
                    _app.survey(method, options);
                }).catch(ex => {
                    if (_touch)
                        _touch.notify({ text: 'Unable to load ' + '~/js/surveys/' + options.controller, duration: 'long' });
                });
                return;
            }
            else
                _app.survey.library[controller] = existingControllerDef;
        }


        if (method === 'show' && values) {
            if (Array.isArray(values)) {
                options.data = data = {};
                values.forEach(function (fv) {
                    data[fv.field || fv.name] = 'newValue' in fv ? fv.newValue : ('oldValue' in fv ? fv.oldValue : fv.value);
                });
            }
            else {
                data = values;
                values = [];
                for (dataKey in data)
                    values.push({ name: dataKey, value: data[dataKey] });
            }
            if (!options.context)
                options.context = {};
            options.values = options.context._initVals = values;
            options.data = options.context._initData = data;
        }
        options.external = !(options.topics || options.questions);
        //if (options.options)
        //    optionsToTags(options);

        function optionsToTags(def) {
            tags = def.tags || def.options && _app.toTags(def.options) || '';
            if (!def.text)
                tags += ' page-header-none ';
            def.tags = tags;
        }

        function toUrl(name) {
            return _app.find(options.parent).get_baseUrl() + (name.match(/\//) ? name : ('/js/surveys/') + name);
        }

        function show(result) {

            function doShow() {
                showCompiled(survey);
                if (survey.cache === false)
                    _app.survey.library[controller] = null;
            }

            try {
                //eval('$app.surveyDef=' + result);
                //var survey = $app.surveyDef;
                //$app.surveyDef = null;
                survey = eval(result);

                var layoutUrl = survey.layout || '';

                if (layoutUrl.match(/(#ref|\.html)$/i)) {
                    busy(true);
                    // load the survey from the server
                    $.ajax({
                        url: toUrl(layoutUrl == '#ref' ? (originalControllerName + '.html') : layoutUrl),
                        dataType: 'text',
                        cache: false
                    }).done(function (result) {
                        busy(false);
                        survey.layout = result;
                        doShow();
                    }).fail(function () {
                        busy(false);
                        if (typeof options.create == 'function')
                            options.create();
                        else
                            _app.alert('Unable to load survey layout for ' + controller + ' from the server.');
                    });
                }
                else
                    doShow();
            }
            catch (ex) {
                _app.alert('The definiton of ' + controller + ' survey is invalid.\n\n' + ex.message + '\n\n' + (_window.location.host.match(/\localhost\b/) ? _app.htmlEncode(ex.stack) : ''));
            }
        }

        function ensureTopics(survey) {
            if (!survey.topics && survey.questions) {
                survey.topics = [{ questions: survey.questions }];
                survey.questions = null;
            }
        }

        function showCompiled(survey) {
            ensureTopics(survey);
            var parentId = options.parent,
                dataView = findDataView(parentId);
            survey.controller = controller;
            survey.baseUrl = dataView ? dataView.get_baseUrl() : appBaseUrl;
            survey.servicePath = dataView ? dataView.get_servicePath() : appServicePath;
            survey.confirmContext = options.confirmContext;
            survey.showSearchBar = true;//dataView.get_showSearchBar();
            survey.parent = parentId;
            survey.context = options.context;
            if (options.options) {
                if (!survey.options)
                    survey.options = {};
                for (var key in options.options)
                    if (survey.options[key] == null)
                        survey.options[key] = options.options[key];
            }

            if (!survey.submit)
                survey.submit = options.submit;
            if (!survey.submitText)
                survey.submitText = options.submitText;
            if (survey.cancel !== false)
                survey.cancel = options.cancel;
            if (!survey.init)
                survey.init = options.init;
            if (!survey.calculate)
                survey.calculate = options.calculate;

            var sharedInstance = survey.sharedInstance;
            if (sharedInstance) {
                var sharedDataView = _touch.dataView();
                if (sharedDataView && sharedDataView._survey && sharedDataView._survey.sharedInstance === sharedInstance) {
                    survey.init = null;
                    survey.compiled = function (result) {
                        for (var key in sharedDataView._backup) {
                            var propValue = sharedDataView._backup[key];
                            if (propValue != null)
                                sharedDataView[key] = propValue;
                            else
                                delete sharedDataView[key];
                        }
                        sharedDataView._pageSession = {}; // mandatory assignment for App Studio lookup cache clearnup
                        _touch.scrollable().empty();
                        sharedDataView._survey.context = survey.context;
                        sharedDataView._originalRow = [];
                        sharedDataView._editRow = [];
                        sharedDataView._onGetPageComplete(result, null);
                        sharedDataView.extension().layout();
                        (options.values || []).forEach(fv => {
                            var field = sharedDataView.findField(fv.field || fv.name);
                            if (field) {
                                sharedDataView._originalRow[field.Index] = fv.value;
                                sharedDataView._editRow[field.Index] = fv.value;
                            }
                        });
                        _app.input.execute({ values: options.values, raiseCalculate: false });
                        $(document).trigger($.Event('pagereadycomplete.app', { dataView: sharedDataView, reverse: false, page: _touch.activePage() }));
                        _touch.scrollable('refresh');
                    };
                    _app.survey('compile', survey);
                    return;
                }
            }

            _app.showModal(dataView, controller, 'form1', 'New', '', survey.baseUrl, survey.servicePath, [],
                { confirmContext: options.confirmContext, showSearchBar: survey.showSearchBar, survey: survey, tags: survey.tags });
        }

        function createRule(list, funcName, func, commandName, commandArgument, phase, argument) {
            var s = 'function(){var r=this,dv=r.dataView(),s=dv.survey(),e=$.Event("' + (typeof func == 'string' ? func : funcName) +
                '",{rules:r,dataView:dv,survey:s' + (argument != null ? (',argument:' + JSON.stringify(argument)) : '') + '});' +
                (typeof func == 'string' ? '$(document).trigger(e);' : ('s.' + funcName + '(e);')) +
                (commandName === 'Calculate' ? '' : 'if(e.isDefaultPrevented())') + 'r.preventDefault();}',
                m = s.match(/^function\s*\(\)\s*\{([\s\S]+?)\}\s*$/);
            if (!commandArgument)
                commandArgument = '';
            list.push({
                "Scope": 6, "Target": null, "Type": 1, "Test": null,
                "Result": "\u003cid\u003er" + list.length + "\u003c/id\u003e\u003ccommand\u003e" + commandName + "\u003c/command\u003e\u003cargument\u003e" + commandArgument + "\u003c/argument\u003e\u003cview\u003eform1\u003c/view\u003e\u003cphase\u003e" + phase + "\u003c/phase\u003e\u003cjs\u003e" + m[1] + "\u003c/js\u003e",
                "ViewId": 'form1'
            });
        }


        function iterate(topics, parent, depth, topicCallback, questionCallback) {
            $(topics).each(function () {
                var t = this;
                if (topicCallback)
                    topicCallback(t, parent);
                $(t.questions).each(function () {
                    var q = this;
                    if (questionCallback)
                        questionCallback(q, t, parent, depth);
                });
                if (t.topics)
                    iterate(t.topics, t, depth + 1, topicCallback, questionCallback);
            });
        }

        function populateItems(list, fields, row, callback) {
            var batch = [], batchList = [], unresolvedBatch = [], clearedList = [];
            // scan the list to ensure that DataValueField and DataTextField are defined
            $(list).each(function (index) {
                var f = this;
                if (!f.ItemsDataValueField)
                    f.ItemsDataValueField = _app.cache[f.ItemsDataController + '_' + f.ItemsDataView + '_DataValueField'];
                if (!f.ItemsDataTextField)
                    f.ItemsDataTextField = _app.cache[f.ItemsDataController + '_' + f.ItemsDataView + '_DataTextField'];
                if (!f.ItemsDataValueField || !f.ItemsDataTextField) {
                    unresolvedBatch.push({
                        controller: f.ItemsDataController,
                        view: f.ItemsDataView,
                        requiresData: false,
                        metadataFilter: ['fields'],
                        _fieldIndex: index
                    });
                }
            });
            if (unresolvedBatch.length) {
                busy(true);
                _app.execute({
                    batch: unresolvedBatch,
                    success: function (result) {
                        $(result).each(function (index) {
                            var f = list[unresolvedBatch[index]._fieldIndex],
                                r = this.rawResponse;
                            if (!f.ItemsDataValueField)
                                $(r.Fields).each(function () {
                                    var f2 = this;
                                    if (f2.IsPrimaryKey) {
                                        f.ItemsDataValueField = f2.Name;
                                        _app.cache[f.ItemsDataController + '_' + f.ItemsDataView + '_DataValueField'] = f2.Name;
                                        return false;
                                    }
                                });
                            if (!f.ItemsDataTextField) {
                                f.ItemsDataTextField = r.Fields[0].Name;
                                _app.cache[f.ItemsDataController + '_' + f.ItemsDataView + '_DataTextField'] = f.ItemsDataTextField;
                            }
                        });
                        populateItems(list, fields, row, callback);
                    },
                    error: function (error) {
                        busy(false);
                    }
                });
                return;
            }
            // request item values
            $(list).each(function () {
                var f = this, m,
                    dataView = f._dataView,
                    fieldFilter = [f.ItemsDataValueField, f.ItemsDataTextField],
                    copy = f.Copy,
                    contextFields = f.ContextFields,
                    selectRequest = {
                        controller: f.ItemsDataController,
                        view: f.ItemsDataView,
                        sortExpression: f.ItemsDataTextField,
                        fieldFilter: fieldFilter,
                        metadataFilter: ['fields'],
                        pageSize: 1000,
                        distinct: _app.is(f.Tag, 'lookup-distinct')// !!(f.Tag && f.Tag.match(/\blookup-distinct(?!-none)/))
                    };
                if (copy)
                    while (m = _app._fieldMapRegex.exec(copy))
                        fieldFilter.push(m[2]);
                if (contextFields) {
                    //if (!row)
                    //    row = dataView.survey('row');
                    var filter = [],
                        contextField;
                    while (m = _app._fieldMapRegex.exec(contextFields)) {
                        if (dataView)
                            contextField = dataView.findField(m[2]);
                        else
                            $(fields).each(function () {
                                var f = this;
                                if (f.Name == m[2]) {
                                    contextField = f;
                                    return false;
                                }
                            });
                        var fieldValue = row[contextField.Index],
                            cascadingDependency = !dependsOn(contextField, f);
                        if (/*f.ItemsDataController != contextField.ItemsDataController && */cascadingDependency || fieldValue != null)
                            if (fieldValue == null && cascadingDependency) {
                                f.Items = [];
                                clearedList.push(f);
                            }
                            else if (contextField.ItemsTargetController || contextField.ItemsStyle === 'CheckBoxList') {
                                var list = _app.csv.toArray(fieldValue);
                                if (list.length <= 1)
                                    filter.push({ field: m[1], value: list[0] });
                                else
                                    filter.push({ field: m[1], operator: 'in', values: list });
                            }
                            else
                                filter.push({ field: m[1], value: fieldValue });
                    }
                    if (filter.length)
                        selectRequest.filter = filter;
                }
                if (!f.skipPopulate && clearedList.indexOf(f) == -1) {
                    batch.push(selectRequest);
                    batchList.push(f);
                }

            });
            if (batch.length) {
                busy(true);
                _app.execute({
                    batch: batch,
                    done: function (result) {
                        busy(false);
                        $(batchList).each(function (index) {
                            var f = this,
                                r = batch[index],
                                p = result[index].rawResponse,
                                pageFieldMap = {};
                            $(p.Fields).each(function (index) {
                                pageFieldMap[this.Name] = index;
                            });
                            f.Items = [];
                            $(p.Rows).each(function () {
                                var row = this,
                                    item = [], i;
                                for (i = 0; i < r.fieldFilter.length; i++)
                                    item.push(row[pageFieldMap[r.fieldFilter[i]]]);
                                if (pageFieldMap['group_count_'] != null)
                                    item.push(row[pageFieldMap['group_count_']]);
                                f.Items.push(item);
                            });
                        });
                        if (callback)
                            callback(batchList.concat(clearedList));
                    },
                    fail: function () {
                        busy(false);
                    }
                });
            }
            else if (callback && clearedList.length)
                callback(batchList);
        }

        function refresh(callback) {
            var dataView = _touch.dataView(),
                extension = dataView.extension();
            options.compiled = function (result) {
                var form = extension._disposeForm();
                dataView._views[0].Layout = options.layout;
                // replace layout
                var newForm = _touch.createLayout(dataView, _touch.calcWidth(form.parent()));
                newForm = newForm.insertAfter(form);
                _touch.prepareLayout(dataView, result.NewRow, newForm);
                form.remove();
                // refresh internal elements
                extension._skipRefresh = true;
                dataView._pageIndex = -1;
                dataView._editRow = null;
                dataView._onGetPageComplete(result, null);
                extension._skipRefresh = false;
                // state has changed
                extension.stateChanged(false);
                if (callback)
                    callback(newForm);
            };
            compile();
        }

        function register(data, callback) {
            var _survey = _app.survey;
            if (!_survey.registrations)
                _survey.registrations = {};
            var result = _survey.registrations[data] != true;
            _survey.registrations[data] = true;
            if (result && callback)
                callback();
            return result;
        }

        function dependsOn(childField, masterField) {
            var contextFields = childField.ContextFields,// var iterator = /\s*(\w+)\s*(=\s*(\w+)\s*)?(,|$)/g;
                test = new RegExp('=\\s*' + masterField.Name + '\\s*(,|$)');
            return !!(contextFields && contextFields.match(test));

        }

        function toSurveyExpression(expr, type) {
            if (!type)
                type = 'string';
            var result = expr,
                func;
            if (typeof expr != type) {
                var expressions = options._expr;
                if (!expressions)
                    expressions = options._expr = [];
                func = expr;
                if (typeof func != 'function')
                    func = function () {
                        return expr;
                    };
                result = 'this._survey._expr[' + expressions.length + '].call(this, this)';
                expressions.push(func);
            }
            return result;
        }

        function compile() {
            var requiresItems = [],
                fieldMap = {}, fieldIndex = 0,
                context = options.context,
                initData = context && context._initData,
                result = {
                    Controller: controller, View: 'form1',
                    TotalRowCount: -1,
                    Fields: [
                        { "Name": "sys_pk_", "Type": "Int32", "Label": "", "IsPrimaryKey": true, "ReadOnly": true, "Hidden": true, "AllowNulls": true, "Columns": 20 }
                    ],
                    Views: [{ Id: 'form1', Label: options.text, Type: 'Form' }],
                    ViewHeaderText: options.description,
                    ViewLayout: options.layout,
                    Expressions: [
                    ],
                    //SupportsCaching: true, IsAuthenticated: true,
                    ActionGroups: [
                        {
                            Scope: 'Form', Id: 'form',
                            Actions: [
                                //{ 'Id': 'a3', 'CommandName': 'Confirm', 'WhenLastCommandName': 'Edit' },
                                //{ 'Id': 'a4', 'CommandName': 'Cancel', 'WhenLastCommandName': 'Edit' },
                                //{ 'Id': 'a5', 'CommandName': 'Edit' }
                            ]
                        }
                    ],
                    Categories: [],
                    NewRow: [1],
                    Rows: []
                },
                buttons = options.actions || options.buttons;

            function addDynamicExpression(scope, target, test) {
                result.Expressions.push({ Scope: scope, Target: target, Test: test, Type: 1, ViewId: 'form1' });
            }

            if (options.submit) {
                var submitKey = options.submitKey;
                result.ActionGroups[0].Actions.push({ Id: 'submit', CommandName: 'Confirm', WhenLastCommandName: 'New', HeaderText: options.submitText, Confirmation: options.submitConfirmation, Key: submitKey === false ? null : (submitKey || 'Enter'), CssClass: options.submitIcon });
            }
            if (options.cancel != false)
                result.ActionGroups[0].Actions.push({ Id: 'a2', CommandName: 'Cancel', WhenLastCommandName: 'New' });

            ensureTopics(options);
            var index = 0;
            iterate(options.topics, null, 0, function (topic, parent, depth) {
                var categoryIndex = result.Categories.length,
                    categoryVisibleWhen = topic.visibleWhen,
                    category = {
                        "Id": "c" + categoryIndex, "Index": categoryIndex,
                        HeaderText: topic.text, Description: topic.description,
                        Wizard: topic.wizard,
                        Flow: topic.flow == 'newColumn' || (index == 0) ? 'NewColumn' : (topic.flow == 'newRow' ? 'NewRow' : ''),
                        Wrap: topic.wrap != null ? topic.wrap : null,
                        Floating: !!topic.floating,
                        Collapsed: topic.collapsed == true,
                        Tab: topic.tab
                    };
                if (categoryVisibleWhen != null)
                    addDynamicExpression(2, category.Id, toSurveyExpression(categoryVisibleWhen));
                if (depth > 0)
                    category.Depth = depth;
                result.Categories.push(category);
                topic._categoryIndex = categoryIndex;
                index++;

            }, function (fd, topic, parent, depth) {
                var fdType = fd.type || 'String',
                    fdFormat = fd.format || fd.dataFormatString,
                    fdMode = fd.mode,
                    fdColumns = fd.columns,
                    fdRows = fd.rows,
                    fdOptions = fd.options,
                    fdTags = fdOptions ? _app.toTags(fdOptions) : fd.tags,
                    items = fd.items,
                    itemsStyle,
                    itemsController,
                    itemsTargetController,
                    fdValue = fd.value,
                    fdContext = fd.context,
                    fdName = fd.name || 'q' + result.Fields.length,
                    fdVisibleWhen = fd.visibleWhen,
                    fdReadOnlyWhen = fd.readOnlyWhen,
                    fdTooltip = fd.tooltip,
                    fdLabel = fd.label,
                    fdText = fdLabel == null ? fd.text : fdLabel,
                    fdAutoCompletePrefixLength = fd.autoCompletePrefixLength,
                    f = {
                        Name: fdName, HtmlEncode: true,
                        AllowNulls: fd.required != true,
                        Label: fdText === false ? '&nbsp;' : fdText || _app.prettyText(fd.name),
                        Hidden: fd.hidden == true,
                        CausesCalculate: fd.causesCalculate == true
                    };
                if (!fdName) return;
                if (initData)
                    if (fdName in initData)
                        fdValue = initData[fdName];
                    else if ('value' in fd) {
                        initData[fdName] = fdValue;
                        context._initVals.push({ field: fdName, value: fdValue });
                    }
                if (fd.causesCalculate)
                    f.CausesCalculate = true;
                switch (fdType.toLowerCase()) {
                    case 'text':
                    case 'string':
                        fdType = 'String';
                        break;
                    case 'date':
                        fdType = 'DateTime';
                        if (!fdFormat) {
                            fdFormat = 'd';
                            if (fdColumns == null)
                                fdColumns = 10;
                        }
                        break;
                    case 'datetime':
                        fdType = 'DateTime';
                        if (fdColumns == null)
                            fdColumns = 20;
                        break;
                    case 'time':
                        fdType = 'DateTime';
                        if (!fdFormat) {
                            fdFormat = 't';
                            if (fdColumns == null)
                                fdColumns = 8;
                        }
                        break;
                    case 'number':
                        fdType = 'Double';
                        break;
                    case 'int':
                        fdType = 'Int32';
                        break;
                    case 'bool':
                    case 'Boolean':
                        fdType = 'Boolean';
                        if (!items && fd.required) {
                            items = { style: 'CheckBox' };
                            if (fdValue == null)
                                fdValue = false;
                        }
                        break;
                    case 'money':
                        fdType = 'Currency';
                        break;
                    case 'memo':
                        fdType = 'String';
                        if (fdRows == null)
                            fdRows = 5;
                        break;
                    case 'blob':
                        //var x = {
                        //    "Name": "Picture",
                        //    "Type": "Byte[]",
                        //    "Label": "Picture",
                        //    "AllowQBE": false,
                        //    "AllowSorting": false,
                        //    "SourceFields": "CategoryID",
                        //    "AllowNulls": true,
                        //    "Columns": 15,
                        //    "OnDemand": true,
                        //    "OnDemandHandler": "CategoriesPicture",
                        //    "ShowInSummary": true
                        //};
                        fdType = 'Byte[]';
                        f.OnDemand = true;
                        f.Multiple = fd.multiple;
                        break;
                }
                f.Type = fdType;
                if (fdType === 'String')
                    f.Len = fd.length || 100;
                if (fdType === 'DateTime' && !fdFormat)
                    fdFormat = 'g';
                if (fdType === 'Currency' && !fdFormat)
                    fdFormat = 'c';
                if (fdFormat)
                    if (typeof fdFormat == 'string')
                        f.DataFormatString = fdFormat;
                    else {
                        var fmt = fdFormat.DataFormatString;
                        if (fmt) {
                            f.DataFormatString = fmt;
                            if (fdType === 'DateTime') {
                                f.TimeFmtStr = fdFormat.TimeFmtStr;
                                f.DateFmtStr = fdFormat.DateFmtStr;
                            }
                        }
                        delete fd.format;
                    }
                if (fdColumns)
                    f.Columns = fdColumns;
                if (fdRows) {
                    f.Rows = fdRows;
                    if (fdType === 'String' && fdRows > 1)
                        f.Len = 0;
                }
                if (fd.placeholder)
                    f.Watermark = fd.placeholder;
                if (fdAutoCompletePrefixLength)
                    f.AutoCompletePrefixLength = fdAutoCompletePrefixLength;
                if (fdTags)
                    f.Tag = typeof fdTags == 'string' ? fdTags : fdTags.join(',');
                if (fdContext) {
                    if (typeof fdContext != 'string') {
                        fdContext.forEach(function (s, index) {
                            if (!s.match(/=/))
                                fdContext[index] = s + '=' + s;
                        });
                        fdContext = fdContext.join(',');
                    }
                    f.ContextFields = fdContext;
                }
                if (fd.htmlEncode === false)
                    f.HtmlEncode = false;

                if (fdMode)
                    f.TextMode = ['password', 'rtf', 'note', 'static'].indexOf(fdMode) + 1;

                if (options.readOnly || fd.readOnly && typeof fd.readOnly != 'function')
                    f.ReadOnly = true;

                if (!f.Hidden)
                    f.CategoryIndex = topic._categoryIndex;
                if (fd.extended)
                    f.Extended = fd.extended;
                if (fd.altText)
                    f.AltHeaderText = fd.altText;
                if (fd.footer)
                    f.FooterText = fd.footer;
                if (fdTooltip)
                    f.ToolTip = fdTooltip;
                if (fd.htmlEncode == false)
                    f.HtmlEncode = false;

                var filter = items && items.filter;
                if (filter) {
                    if (typeof filter != 'string') {
                        filter = [];
                        $(items.filter).each(function () {
                            var filterInfo = this;
                            filter.push(filterInfo.match + '=' + filterInfo.to);
                        });
                        filter = filter.join(',');
                    }
                    f.ContextFields = filter;
                }

                if (items) {
                    //var itemsList = items.values || items.list;
                    itemsController = items.controller;
                    itemsStyle = items.style || (items.list || !itemsController ? 'DropDownList' : 'Lookup');
                    f.Items = [];
                    if (_isTagged(fdTags, 'lookup-auto-complete-anywhere'))
                        f.SearchOptions = '$autocompleteanywhere';
                    if (itemsStyle === 'Lookup' && _isTagged(fdTags, 'lookup-distinct'))
                        itemsStyle = 'AutoComplete';
                    if (itemsStyle.match(/AutoComplete|Lookup|DropDown/) && _isTagged(fdTags, 'lookup-multiple')) {
                        f.ItemsTargetController = '_basket';
                        if (itemsStyle === 'AutoComplete' && fdValue != null) {
                            if (items.dataValueField === items.dataTextField) {
                                if (typeof fdValue == 'string')
                                    fdValue = _app.csv.toArray(fdValue);
                                $(fdValue).each(function () {
                                    var v = this;
                                    f.Items.push([v, v, null]);
                                });
                            }
                            else
                                requiresItems.push(f);
                        }
                    }
                    itemsTargetController = items.targetController;
                    if (itemsTargetController)
                        f.ItemsTargetController = itemsTargetController;
                    if (fdValue != null && (f.ItemsTargetController || itemsStyle === 'CheckBoxList')) {
                        if (Array.isArray(fdValue))
                            fdValue = _app.csv.toString(fdValue);
                        else if (typeof fdValue != 'string')
                            fdValue = fdValue.toString();
                    }
                    //if (_app.read(fd, 'options.lookup.distinct'))
                    //    f.DistinctValues = true;
                    if (items.list) {
                        $(items.list).each(function () {
                            var item = this, v = item.value, t = item.text, c = item.count,
                                newItem = [v, t == null ? v : t];
                            if (c != null)
                                newItem.push(c);
                            f.Items.push(newItem);
                        });
                    }
                    else if (itemsController) {
                        f.ItemsDataController = itemsController;
                        f.ItemsDataView = items.view || 'grid1',
                            f.ItemsDataValueField = items.dataValueField;
                        f.ItemsDataTextField = items.dataTextField;
                        f.ItemsNewDataView = items.newView;
                        if (!itemsStyle.match(/AutoComplete|Lookup/))
                            requiresItems.push(f);
                        if (items.dataValueField !== items.dataTextField)
                            f._autoAlias = true;
                    }
                    f.ItemsStyle = itemsStyle;
                    if (items.disabled)
                        f.ItemsStyle = null;

                    var copy = items.copy;
                    if (copy) {
                        if (typeof copy != 'string') {
                            copy = [];
                            $(items.copy).each(function (index) {
                                var copyInfo = this;
                                copy.push(copyInfo.to + '=' + copyInfo.from);
                                if (copyInfo.from === items.dataTextField) {
                                    f.AliasName = copyInfo.to;
                                    f._autoAlias = false;
                                }
                            });
                            copy = copy.join('\n');
                        }
                        f.Copy = copy;
                    }
                }
                if ('default' in fd)
                    f._defVal = fd.default;
                if (fdVisibleWhen != null)
                    //result.Expressions.push({ Scope: 3, Target: fd.name, Test: fdVisibleWhen, Type: 1, ViewId: 'form1' });
                    addDynamicExpression(3, fdName, toSurveyExpression(fdVisibleWhen));
                if (fdReadOnlyWhen != null)
                    //result.Expressions.push({ Scope: 5, Target: fd.name, Test: fdReadOnlyWhen, Type: 1, ViewId: 'form1' });
                    addDynamicExpression(5, fdName, toSurveyExpression(fdReadOnlyWhen), 5);
                result.Fields.push(f);
                fieldMap[f.Name] = f;
                if (typeof fdValue != 'function')
                    result.NewRow[result.Fields.length - 1] = fdValue;
            });

            result.Fields.forEach(function (f) {
                var contextFields = f.ContextFields;
                f.Index = fieldIndex++;
                if (contextFields)
                    $(contextFields.split(_app._simpleListRegex)).each(function () {
                        var cm = this.split(_app._fieldMapRegex),
                            cf = cm ? fieldMap[cm[2]] : null;
                        if (cf && cf.ItemsDataController === f.ItemsDataController) {
                            f.requiresDynamicNullItem = true;
                            return false;
                        }
                    });
            });

            if (options.init)
                createRule(result.Expressions, 'init', options.init, 'New', 'form1', 'After');
            if (options.submit)
                createRule(result.Expressions, 'submit', options.submit, 'Confirm', null, 'Before');
            if (options.cancel)
                createRule(result.Expressions, 'cancel', options.cancel, 'Cancel', null, 'Before');
            if (options.calculate)
                createRule(result.Expressions, 'calculate', options.calculate, 'Calculate', null, 'Execute');

            // create actions and matching business rules from buttons
            if (buttons) {
                var actionGroupMap = { form: result.ActionGroups[0] },
                    positionBefore = 0;
                options._handlers = {};
                buttons.forEach(function (btn, index) {
                    var scope = btn.scope,
                        group, action,
                        btnWhen = btn.when,
                        btnClick = btn.click || btn.execute || btn.trigger,
                        btnId = btn.id || ('b' + index),
                        btnText = btn.text,
                        btnPosition = btn.position,
                        actions;
                    if (!scope)
                        scope = 'form';
                    group = actionGroupMap[scope];
                    if (btnText)
                        action = { Id: btnId, CommandName: btnId, WhenLastCommandName: 'New', HeaderText: btnText, Key: btn.key, CausesValidation: btn.causesValidation, Confirmation: btn.confirmation };
                    else
                        action = { Id: 'div' + group.Actions.length, WhenLastCommandName: 'New' };
                    if (btn.icon)
                        action.CssClass = btn.icon;
                    if (btnWhen)
                        action.WhenClientScript = typeof btnWhen == 'function' ? btnWhen :
                            function () {
                                var e = $.Event(btnWhen, { dataView: this, argument: btn.argument });
                                $document.trigger(e);
                                return !e.isDefaultPrevented();
                            };
                    if (!group) {
                        group = { Scope: scope[0].toUpperCase() + scope.substring(1), Id: scope, Actions: [] };
                        result.ActionGroups.push(group);
                        actionGroupMap[scope] = group;
                    }
                    actions = group.Actions;
                    if (scope === 'form' && btnPosition !== 'after')
                        if (btnPosition === 'before' || options.cancel === false)
                            actions.splice(positionBefore++, 0, action);
                        else
                            actions.splice(actions.length - 1, 0, action);
                    else
                        actions.push(action);
                    if (btnClick) {
                        if (typeof btnClick == 'function')
                            options._handlers[btnId] = function (e) {
                                e.preventDefault();
                                btnClick.call(e.dataView, e);
                            };
                        createRule(result.Expressions, '_handlers.' + btnId, btnClick, btnId, null, 'Execute', btn.argument);
                    }
                });
            }
            optionsToTags(options);
            result.Tag = (options.tags || '') + ' ignore-unsaved-changes';
            if (result.Fields.length === 1)
                result.Fields[0].Hidden = false;
            var compileCallback = options.compiled;
            if (compileCallback) {
                if (requiresItems.length)
                    populateItems(requiresItems, result.Fields, result.NewRow, function () {
                        compileCallback(result);
                    });
                else
                    compileCallback(result);
                options.compiled = null;
            }
            return result;
        }

        function failedToLoad(result) {
            busy(false);
            var create = options.create;
            if (create)
                if (typeof create == 'string')
                    $document.trigger($.Event(create, { survey: options }));
                else
                    create.call(options);
            else
                _app.alert('Unable to load survey ' + controller + ' from the server.');
        }

        if (method === 'show')
            if (options.external) {
                var survey = _app.survey.library[controller];
                if (survey)
                    show(survey);
                else {
                    busy(true);
                    var dataView = findDataView(options.parent);
                    // load the survey from the server

                    if (options.tryLoad === false || _app.survey.failedToLoad[controller])
                        failedToLoad({});
                    else
                        $.ajax({
                            //url:  toUrl(originalControllerName + '.js'),// dataView.get_baseUrl() + '/scripts/surveys/' + originalControllerName + '.js',
                            //dataType: 'text',
                            //cache: false
                            url: appServicePath + '/GetSurvey',
                            data: JSON.stringify({ name: originalControllerName }),
                            processData: false,
                            method: 'POST',
                            cache: false
                        }).done(function (result) {
                            busy(false);
                            result = result.d;
                            if (typeof result == 'string') {
                                _app.survey.library[controller] = result;
                                show(result);
                            }
                            else {
                                failedToLoad(result);
                                _app.survey.failedToLoad[controller] = true;
                            }
                        }).fail(failedToLoad);
                }
            }
            else
                showCompiled(options);
        else if (method === 'compile')
            // produce an emulation of the server response for a controller and call GetPageComplete with the result
            return compile();
        else if (method === 'populateItems') {
            var fieldWithContext = [];
            dataView = options.dataView;
            $(dataView._allFields).each(function () {
                var f = this;
                if (f.ItemsAreDynamic && f.ContextFields && !f.skipPopulate)
                    fieldWithContext.push(f);
            });
            if (fieldWithContext.length)
                populateItems(fieldWithContext, dataView._allFields, dataView.row(), options.callback);
        }
        else if (method === 'refresh')
            refresh(arguments[2]);
        else if (method === 'register')
            return register(arguments[1], arguments[2]);
        else
            _app.alert('Unsupported survey method: ' + method);
    };

    _app.survey.library = {}

    _app.survey.failedToLoad = {};

    function busy(isBusy) {
        if (_touch)
            _touch.busy(isBusy);
    }

})();