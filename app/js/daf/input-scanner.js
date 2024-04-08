/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Data Aquarium Framework  - Universal Scanner and Input
* Copyright 2023 Code On Time LLC; Licensed MIT; http://codeontime.com/license
*/

(function () {

    var _app = $app,
        _input = _app.input,
        _touch = _app.touch,
        $settings = _touch.settings,
        resources = Web.DataViewResources,
        resourcesMobile = resources.Mobile,
        defaultBarcodeReaderHeight = $settings('barcodeReader.viewFinder.height') || '120',
        codeReader,
        _readerState = {},
        deviceList = [],
        selectedDeviceId = _app.userVar('scannerDeviceId'),
        lastInventoryResult,
        lastResult,
        _readerTypes = {
            '1D': 'BrowserMultiFormatOneDReader',
            'Multi': 'BrowserMultiFormatReader',
            'QRCode': 'BrowserQRCodeReader',
            'Aztec': 'BrowserAztecCodeReader',
            'DataMatrix': 'BrowserDatamatrixCodeReader',
            'PDF417': 'BrowserPDF417CodeReader'
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


    // Library:
    // https://github.com/zxing-js/browser
    // https://unpkg.com/@zxing/library@latest
    // https://unpkg.com/@zxing/library@latest/umd/index.min.js
    //
    // Barcode source: https://zxing-js.github.io/library/examples/multi-camera/
    // QR CODE source: https://zxing-js.github.io/library/examples/qr-video/

    // Icons: qr_code_scanner, barcode_reader, qr_code
    // See https://fonts.google.com/icons?icon.query=barcode


    // collect garbage
    setInterval(() => {
        for (var deviceId in _readerState) {
            if (stopCodeReader(deviceId))
                return;
        }
    }, 2500);

    function stopCodeReader(deviceId, force) {
        var state = _readerState[deviceId],
            page;
        if (state) {
            if (!force)
                page = state.video.closest('.ui-page');
            if (force || (!page.length || page.is('.app-internal-form-scanner') && !page.is('.ui-page-active'))) {
                state.controls.stop();
                delete _readerState[deviceId];
                return true;
            }
        }
        return false;
    }

    function toggleViewFinderState(placeholder, visible) {
        var page = placeholder.closest('.ui-page');
        if (visible) {
            if (!page.find('[data-input-enhancement="scanner"] [data-state="active"]').length) {
                placeholder.show().attr('data-state', 'active');
                _touch.resetPageHeight();
            }
        }
        else if (placeholder.attr('data-state') === 'active') {
            var state = _readerState[selectedDeviceId];
            if (state && placeholder.has(state.video))
                stopCodeReader(selectedDeviceId, true);
            placeholder.attr('data-state', 'pending').hide();
            var activeScanner = page.find('[data-input-enhancement="scanner"].app-null [data-state="inactive"]').first().attr('data-state', 'active').show();
            _touch.resetPageHeight();
            placeholder.attr('data-state', 'inactive');
            if (activeScanner.length) {
                var field = _input.elementToField(activeScanner);
                _app.input.methods.scanner._read(activeScanner.find('video'), field);
            }
        }
        else
            placeholder.hide();
    }

    _app.input.methods.scanner = {
        _init: function (field, v, t, enhancementPlaceholder) {
            var video = enhancementPlaceholder.find('video'),
                placeholder = enhancementPlaceholder.closest('.app-control-after'),
                viewFinderAlways = field.tagged('input-scanner-view-finder-always') || field.tagged('input-scanner-value-hidden'),
                isVisible = field._dataView.editing() && (v == null || viewFinderAlways);
            if (field._dataView._inlineEditor || _touch.uiAutomation())
                placeholder.hide();
            else if (!video.length && isVisible) {
                var frame = $div('app-enhancement-frame').appendTo(enhancementPlaceholder).css({ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }),
                    frameRect = _app.clientRect(frame);

                if (frameRect.height < 10)
                    frame.parent().css({ width: '100%', height: defaultBarcodeReaderHeight });
                placeholder.show().attr('data-state', placeholder.closest('.ui-page').find('[data-input-enhancement="scanner"] [data-state="active"]').length ? 'inactive' : 'active');
                _touch.icon('material-icon-more-' + (_app.agent.chromeOS || _app.agent.android ? 'vert' : 'horiz'), frame).attr('title', resourcesMobile.More);
                video = $htmlTag('video').appendTo(frame);//.css({ position: 'absolute', left: -10000, maxWidth: frameRect.width - 2 });
                video[0].disablePictureInPicture = true;
                if (!codeReader) {
                    _app.getScript('~/js/lib/zxing.min.js', {
                        also: '~/css/daf/input-scanner.[min].css'
                    }).then(() => {
                        codeReader = new ZXingBrowser[_readerTypes[$settings('barcodeReader.format')] || _readerTypes['Multi']];
                        _app.input.methods.scanner._read(video, field);
                    });
                }
                else
                    _app.input.methods.scanner._read(video, field);
            }
            else if (!viewFinderAlways)
                toggleViewFinderState(placeholder, isVisible);
        },
        _read: function (video, field) {
            enumerateDevices()
                .then(list => {
                    var enhancement = video.closest('.app-control-after');
                    if (!codeReader || enhancement.attr('data-state') === 'inactive')
                        return;
                    if (stopCodeReader(selectedDeviceId, true)) {
                        // do not beging detection until the previous scanning sequence has stopped
                        setTimeout(_app.input.methods.scanner._read, 0, video, field);
                        return
                    }
                    if (!enhancement.is(':visible'))
                        toggleViewFinderState(enhancement, true);
                    enhancement.find('.app-scan-error').remove();
                    codeReader.decodeFromVideoDevice(selectedDeviceId, video[0],
                        (result, error, controls) => {
                            if (!_readerState[selectedDeviceId])
                                _readerState[selectedDeviceId] = { video: video, controls: controls };
                            if (result) {
                                if (!_touch.busy() && !field._dataView._busy() && video.closest('.ui-page-active').length) {
                                    var data = field._dataView.data(),
                                        resultText = result.text;
                                    if (data[field.Name] !== resultText) {
                                        // do not trigger the same code for X number of seconds
                                        if (resultText != enumerateDevices._lastResultText ||
                                            enumerateDevices._lastResultDate && new Date().getTime() - enumerateDevices._lastResultDate > 3000) {
                                            // mark the scanned area
                                            // TODO: create a path specified as an array in 'points'
                                            // var points = result.getResultPoints();

                                            video.closest('.app-enhancement-frame').addClass('app-detected');

                                            enumerateDevices._lastResultText = resultText;
                                            enumerateDevices._lastResultDate = new Date().getTime();
                                            lastResult = resultText;

                                            setTimeout(() => {
                                                video.closest('.app-enhancement-frame').removeClass('app-detected');
                                                _input.execute({ values: { name: field.Name, value: resultText } });
                                                setFocus(field.Name);
                                                //if (!field.tagged('input-scanner-view-finder-always') && !field.tagged('input-scanner-value-hidden'))
                                                //    //var input = video.closest('.ui-page').find(`[data-field="${field.Name}"]`);
                                                //    //stopCodeReader(selectedDeviceId, true);
                                                //    toggleViewFinderState(video.closest('.app-control-after'), false);
                                            }, 100);
                                        }

                                    }
                                    //    else
                                    //        console.log(resultText);
                                }
                                //    else
                                //        console.log(resultText);
                            }
                            if (error) {
                                //console.error(error)
                            }
                        }).
                        catch(ex => {
                            $div('app-scan-error').insertBefore(video).text(ex.message);
                        });
                })
                .catch((ex) => {
                    video.closest('.app-control-after').hide();
                    //notSupported(ex);
                });
        },
        render: function (options) {
            //var that = this,
            //    dataInput = options.container,
            //    inner = options.inner,
            //    field = options.field,
            //    onDemandStyle = field.OnDemandStyle,
            //    dataView = field._dataView,
            //    video = dataInput.find('app-inner-video');
            _input.methods.text.render(options);
        },
        focus: function (target) {
            return _input.methods.text.focus(target);
        },
        click: function (event) {
            _input.methods.text.click(event);
        },
        blur: function (event) {
            _input.methods.text.blur(event);
        },
        setup: function (event) {
            _input.methods.text.setup(event);
        },
        _showForm: function () {
            _touch.busy(true);
            enumerateDevices()
                .then(list => {
                    _touch.busy(false);
                    _touch.whenPageShown(() => _touch.activePage().addClass('app-internal-form-scanner'));
                    $app.survey({
                        context: { devices: list },
                        text: resourcesMobile.Scan,
                        text2: $app.touch.appName(),
                        values: { Source: selectedDeviceId, InventoryMode: _app.userVar('scannerInventoryMode') || false, InventoryResult: lastInventoryResult },
                        topics: [
                            {
                                wrap: true,
                                questions: [
                                    {
                                        name: 'Result',
                                        type: 'text',
                                        text: false,//'Result',
                                        placeholder: resourcesMobile.ScanHint,
                                        //length: options.codeLength,
                                        causesCalculate: true,
                                        options: {
                                            focus: {
                                                auto: true
                                            },
                                            input: {
                                                scanner: {
                                                    //size: '100%x' + defaultBarcodeReaderHeight,
                                                    viewFinder: 'always' // default is 'auto'
                                                    //controls: false
                                                }
                                            }
                                        }
                                    },
                                    {
                                        name: 'InventoryMode',
                                        type: 'boolean',
                                        text: resourcesMobile.ScanInvMode,
                                        items: {
                                            style: 'CheckBox',
                                            list: [
                                                { value: false, 'text': 'No' },
                                                { value: true, 'text': 'Yes' },
                                            ]
                                        },
                                        causesCalculate: true
                                    },
                                    {
                                        name: 'InventoryResult',
                                        text: false,
                                        mode: 'static',
                                        visibleWhen: '$row.InventoryMode',
                                        options: {
                                            mergeWithPrevious: true,
                                            textAction: 'copy'
                                        }
                                        //placeholder: 'Detected barcodes will appear here.'
                                    },
                                    {
                                        name: 'InventoryActions',
                                        text: false,
                                        rows: 1,
                                        items: {
                                            style: 'Actions'
                                        },
                                        options: {
                                            mergeWithPrevious: true
                                        },
                                        visibleWhen: function () {
                                            return this.fieldValue('InventoryMode') && this.fieldValue('InventoryResult') != null;
                                        }
                                    }
                                ]
                            }
                        ],
                        actions: [
                            {
                                text: resourcesMobile.LookupClearAction,
                                execute: 'scannerformclear.scanner.app',
                                scope: 'InventoryActions'
                            },
                            {
                                text: resources.Editor.Undo,
                                execute: 'scannerformundo.scanner.app',
                                scope: 'InventoryActions',
                                when: function () {
                                    return (this.fieldValue('InventoryResult') || '').match(/\s/);
                                }
                            }
                        ],
                        // modal-fit-content modal-auto-grow modal-max-xs material-icon-lock-outline discard-changes-prompt-none
                        options: {
                            modal: {
                                fitContent: true,
                                autoGrow: true,
                                max: 'xxs'
                            },
                            materialIcon: ($settings('barcodeReader.icon') || 'barcode-reader').replace('material-icon-', ''),
                            discardChangesPrompt: false,
                            internal: {
                                form: 'scanner'
                            }
                        },
                        submitText: resourcesMobile.Send,
                        submit: 'scannerformsubmit.scanner.app',
                        calculate: 'scannerformcalculate.scanner.app.app'
                    });
                })
                .catch((ex) => {
                    _touch.busy(false);
                    notSupported(ex);
                });
        }
    };

    function enumerateDevices() {
        var list = [];
        return new Promise(function (resolve, reject) {
            if (deviceList.length && (new Date().getTime() - enumerateDevices._lastTest < 60 * 10 * 1000)) // refresh the device list every 10 minutes.
                resolve(deviceList);
            else if (navigator.mediaDevices) {
                navigator.mediaDevices.enumerateDevices()
                    .then(devices => {
                        var foundLastUsed;
                        devices.forEach(d => {
                            if (d.kind === 'videoinput') {
                                list.push({ value: d.deviceId, text: d.label });
                                if (d.deviceId === selectedDeviceId)
                                    foundLastUsed = true;
                            }
                        });

                        deviceList = list;
                        if (list.length) {
                            enumerateDevices._lastTest = new Date().getTime();
                            for (var i = 0; i < list.length; i++)
                                if (!list[i].text) {
                                    list[i].text = 'Camera ' + (i + 1);
                                    enumerateDevices._lastTest = null;
                                }
                            if (!foundLastUsed)
                                selectedDeviceId = list[list.length - 1].value; // get the last device. This will usually be the rear-facing camera, which is better for scanning.
                            resolve(list);
                        }
                        else {
                            selectedDeviceId = null;
                            reject(new Error(resources.ODP.UnableToExec));
                        }
                    });
            }
            else
                reject(list);
        });
    }

    function restartScanning(target, force) {
        var dataInput = _input.of(target);
        var field = _input.elementToField(dataInput);
        var video = dataInput.find('video');
        if (force || !video.is(':visible'))
            _app.input.methods.scanner._read(video, field);
    }

    function notSupported(ex) {
        $app.touch.notify({ text: ex.message/*'There are no devices capable of scanning.'*/, duration: 'long' });
    }

    function sendBarcodes(result) {
        lastResult = result;
        _touch.activePage().addClass('app-transition-none');
        var isInventoryMode = result instanceof Array;
        stopCodeReader(selectedDeviceId, true);
        _touch.goBack(() => {
            if (isInventoryMode)
                _app.input.barcode.apply(_app.input.barcode, result);
            else
                _app.input.barcode(result);
        });
    }

    function setFocus(fieldName) {
        if (!_touch.pointer('touch'))
            _input.focus({ field: fieldName || 'Result' });
    }

    $(document)
        .on('scannerformcalculate.scanner.app.app', (e) => {
            var data = e.dataView.data();
            switch (e.rules.arguments().CommandArgument) {
                case 'Result':
                    var result = data.Result;
                    e.survey.context._codeDetected = new Date().getTime();
                    if (data.InventoryMode) {
                        var inventoryResult = data.InventoryResult || '';
                        if (inventoryResult.length)
                            inventoryResult += ' ';
                        if (result == null)
                            setTimeout(setFocus);
                        else {
                            inventoryResult += result;
                            setTimeout(() => {
                                _input.execute({ values: { Result: null, InventoryResult: inventoryResult } });
                                setFocus();
                            }, 100);
                        }
                    }
                    else
                        sendBarcodes(result);
                    break;
                case 'InventoryMode':
                    _app.userVar('scannerInventoryMode', data.InventoryMode ? true : null);
                    setTimeout(setFocus);
                    break;
            }
            return false;
        })
        .on('scannerformsubmit.scanner.app', e => {
            e.preventDefault();
            if (new Date().getTime() - e.survey.context._codeDetected < 250)
                return;
            var data = e.dataView.data();
            if (data.InventoryMode) {
                var inventoryResult = data.InventoryResult;
                if (inventoryResult == null)
                    setFocus();
                else {
                    lastInventoryResult = inventoryResult
                    sendBarcodes(inventoryResult.split(/\s+/));
                }
            }
            else {
                if (data.Result == null)
                    setFocus();
                else
                    sendBarcodes(data.Result);
            }
        })
        .on('scannerformclear.scanner.app', e => {
            e.preventDefault();
            _input.execute({ InventoryResult: null });
        })
        .on('scannerformundo.scanner.app', e => {
            e.preventDefault();
            var data = e.dataView.data(),
                inventoryResult = data.InventoryResult.split(/\s+/g);
            inventoryResult.splice(inventoryResult.length - 1, 1);
            _input.execute({ InventoryResult: inventoryResult.join(' ') });
            setFocus();
        })
        .on('setvalue.input.app', '[data-input-enhancement="scanner"]', (e) => {
            var inputValue = e.inputValue;
            if (inputValue != null && inputValue.length) {
                var dataInput = _input.of(e.inputElement);
                var field = _input.elementToField(dataInput);
                if (!field.tagged('input-scanner-view-finder-always'))
                    setTimeout(() => {
                        toggleViewFinderState(dataInput.find('.app-control-after'), false);
                    });
            }
            else
                restartScanning(e.target);
        })
        .on('vclick', '[data-input-enhancement="scanner"] .app-enhancement-frame .app-icon', (e) => {
            var dataInput = _input.of(e.target),
                field = _input.elementToField(dataInput),
                items = [],
                selected = selectedDeviceId,
                targetRect = _app.clientRect(e.target);
            if (!_readerState[selected] || !_readerState[selected].video.closest('.ui-page-active').length)
                selected = null;
            enumerateDevices().then(list => {
                list.forEach(((d, index) => {
                    items.push({
                        text: d.text, icon: d.value === selected ? 'check' : null, context: d, callback: (d) => {
                            selectedDeviceId = d.value;
                            _app.userVar('scannerDeviceId', index === list.length - 1 ? null : selectedDeviceId);
                            restartScanning(e.target, true);
                        }
                    });
                }));
                if (items.length) {
                    if (lastResult) {
                        items.push({});
                        if (!Array.isArray(lastResult))
                            lastResult = lastResult.split(/\s+/g);
                        lastResult.forEach(code => {
                            items.push({
                                text: code, context: code, callback: code => {
                                    var saveLastResult = lastResult;
                                    _input.execute({ field: dataInput.data('field'), value: code });
                                    setFocus(dataInput.data('field'));
                                    lastResult = saveLastResult;
                                }
                            });
                        })
                    }
                    _touch.activePage().removeData('last-focused-field');
                    _touch.listPopup({ arrow: 'b,t,l,r', x: targetRect.left + targetRect.width / 2, y: targetRect.top, items: items });
                }
            })

            return false;
        });

})();