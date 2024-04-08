/*eslint eqeqeq: ["error", "smart"]*/
/*!
* Touch UI - Sidebar 2.0
* Copyright 2024 Code On Time LLC; Licensed MIT; http://codeontime.com/license
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
        miniSidebarWidth = 56,

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

    _touch.sideBar = function (method, options, resolve, reject) {

        function doResolve() {
            initSideBar();
            _touch.sideBar.ready = true;
            resolve();
        }

        if (resolve) {
            if (requiresTreeView()) {
                _touch.treeView()
                    .then(doResolve);
            }
            else
                doResolve();
        }
    };

    function initSideBar() {
        var sidebar = $('.app-sidebar').first();
        $div().attr('data-draggable', 'sidebar-resizer')
            .insertAfter(sidebar);
        sidebarChanged(sidebar);
    }

    _app.dragMan['sidebar-resizer'] = {
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

            that._target = target;
            target.addClass('app-dragging');

            var sidebar = that._sidebar = target.closest('.app-sidebar');
            that._location = 'left';
            that._width = sidebar.width();
            that._availWidth = _touch.screen().width;
            that._minX = _touch.screen().left + miniSidebarWidth;
            that._maxX = _touch.screen().left + maxSidebarWidth();
            that._deltaX = rect.left - drag.x + (that._location === 'left' ? rect.width : 0);
        },
        move: function (drag) {
            var that = this;
            var newX = Math.round(drag.x + that._deltaX);
            if (newX < that._minX)
                newX = that._minX;
            if (newX > that._maxX)
                newX = that._maxX;
            var newWidth = newX - _touch.screen().left;
            if (newWidth != that._newWidth)
                that._position(newWidth);
        },
        cancel: function (drag) {
            var that = this;
            if (that._width != null)
                that._position(that._width);
            that._target.removeClass('app-dragging');
            delete that._target;
            delete that._sidebar;
        },
        end: function (drag) {
            var that = this;
            /*
            propGridComponentProperty('width', null, that._newWidth);
            if (that._dividers.length) {
                var newDividerX = parseInt(that._dividers[0].style.left);
                propGridComponentProperty('divider.x', null, Math.abs(newDividerX - that._newWidth / 2) > 1 ? newDividerX : null);
            }
            */
            delete that._width;
            that.cancel();
        },
        _position: function (newWidth) {
            var that = this;
            that._newWidth = newWidth;
            changeSidebarWidth(newWidth);
        }
    };

    function maxSidebarWidth() {
        return Math.round(_touch.screen().width / 2);
    }

    function changeSidebarWidth(newWidth) {
        var barLeft = __settings.bars.left;
        barLeft.defaultWidth = newWidth;
        barLeft.animate = false;
        _touch.sidebar('toggle', miniSidebarWidth == newWidth);
        var mini = barLeft.mini;
        if (mini) {
            barLeft.defaultWidth = _touch.sidebar('defaultWidth');
        }
        else {
            _app.userVar('sidebar.width', newWidth);
            _touch.settings('ui.sidebar.width')

        }
        _touch.settings('ui.sidebar.mini', mini);
        _app.userVar('minisidebar', mini);

        barLeft.animate = true;
    }


    function sidebarChanged(sidebar) {
        if (!sidebar)
            sidebar = $('.app-sidebar').first();
        if (sidebar.length) {
            var leftBar = __settings.bars.left;
            if (!leftBar.mini && leftBar.width > maxSidebarWidth())
                changeSidebarWidth(maxSidebarWidth());
            else {
                var sidebarRect = getBoundingClientRect(sidebar);
                $('[data-draggable="sidebar-resizer"]').css({ top: sidebarRect.top, left: sidebarRect.right - 4, height: sidebarRect.height });
            }
            sidebar.find('.app-treeview').toggleClass('app-treeview-hidden', leftBar.mini === true);
        }
    }

    function requiresTreeView() {
        return (_touch.settings('ui.menu.style') || 'tree') === 'tree';
    }

    $document
        .on('dblclick', '[data-draggable="sidebar-resizer"]', e => {
            //propGridComponentProperty('width', null, null);
            //var page = activePage();
            //var newWidth = _touch.toWidth('xxs');
            //var dividerX = propGridComponentProperty('divider.x', null);
            //page.removeData('modalWidth');
            //resizePropGrid(page, null, newWidth, null, dividerX ? (newWidth / _app.clientRect(page).width * dividerX) : null);
            var barLeft = __settings.bars.left;
            var defaultWidth = _touch.sidebar('defaultWidth');
            if (barLeft.mini || barLeft.defaultWidth != defaultWidth)
                changeSidebarWidth(defaultWidth);
            else
                changeSidebarWidth(miniSidebarWidth);
            return false;
        })
        .on('resized.app', e => {
            sidebarChanged();
        })
        .on('beforesidebarpanelshow.app', e => {
            if (requiresTreeView()) {
                var items = e.panel.items;
                var menuItems = [];
                var index = 0;
                while (index < items.length)
                    if (items[index].depth) {
                        menuItems.push(items[index]);
                        items.splice(index, 1);
                    }
                    else
                        index++;
                while (items.length && items[0].text == null)
                    items.splice(0, 1);
                if (menuItems.length && !e.panel.elem.find('.app-treeview').length) {
                    var listView = e.panel.elem.find('.ui-listview'),
                        treeOptions = itemsToTreeOptions(menuItems);
                    if (_touch.settings('ui.menu.position') === 'bottom')
                        treeOptions.after = listView;
                    else
                        treeOptions.before = listView;
                    _touch.treeView(treeOptions);
                    e.panel.elem.find('.app-treeview').data('originalPath', treeOptions.path);
                }
            }
        })
        .on('treeview.app', e => {
            var treeView = e.treeView;
            if (treeView.hierarchy === 'sitemap' && treeView.eventName === 'select' && treeView.treeView.data('originalPath') != treeView.nodePath) {
                treeView.node.sitemap.callback(treeView.node.sitemap.context);
            }
        })
        .on('menuchanged.app', function (e) {
            $('.app-sidebar .app-treeview').remove();
        });

    function itemsToTreeOptions(items) {
        var parent = {
            nodes: {},
            type: 'sitemap'
        };
        var root = parent;
        var index = 0;
        var iconCount = 0;
        var autoExpand = _touch.settings('ui.menu.autoExpand') || 'current';

        while (index < items.length) {
            var item = items[index];
            var n = {
                text: item.text, name: 'n' + index, sitemap: { context: item.context, callback: item.callback }
            };
            if (item.icon) {
                iconCount++;
                n.icon = item.icon;
            }
            if (item.tooltip)
                n.tooltip = item.tooltip;
            parent.nodes[n.name] = n;
            n.parent = parent;
            if (item.selected) {
                var path = [];
                var n2 = n;
                while (n2 && n2.name) {
                    path.splice(0, 0, n2.name);
                    n2 = n2.parent;
                }
                n2.path = path.join('/');
                if (autoExpand == 'current')
                    n.expanded = true;
            }
            index++;
            if (index < items.length) {
                var nextItem = items[index];
                var nextDepth = nextItem.depth;
                if (nextDepth > item.depth) {
                    if (!n.nodes)
                        n.nodes = {};
                    if (autoExpand == 'all')
                        n.expanded = true;
                    parent = n;
                }
                else if (nextDepth < item.depth) {
                    var itemDepth = item.depth;
                    while (nextDepth < itemDepth--)
                        parent = parent.parent;
                }
            }
        }

        root.icons = iconCount > 0;
        return root;
    }

})();