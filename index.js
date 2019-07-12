import MicroDataEditor from 'DataEditor'

/**
* some styles for container and editor
*/
const mainCss = require('./css/main.css');

window.Rmx = window.Rmx || {
    getc: function(event) {
        var ssid = event.currentTarget.getAttribute('data-ssid');
        return Rmx.Containers[ssid];
    },
    Containers: {

    },
    Actions: {
        onEdit: function(e) {
            var c = Rmx.getc(e);
            c.selectControlPanelItem(0); // 0 - "Edit" tab index
            c.renderEditor();
        },
        onJson: function(e) {
            var c = Rmx.getc(e);
            c.selectControlPanelItem(1);
            c.renderJsonViewer();
        },
        onClose: function(e) {
            var c = Rmx.getc(e);
            c.selectControlPanelItem(-1);
        },
        setProperty: function(e) {
            var c = Rmx.getc(e);
            var prop = e.currentTarget.getAttribute('data-prop');
            var value = e.currentTarget.value;
            c.setProperty(prop, value);
        },
        onHLAdd: function(e) {
            var c = Rmx.getc(e);
            var prop = e.currentTarget.getAttribute('data-prop');
            c.addHashlistElement(prop);
        },
        onHLEDelete: function(e) {
            var c = Rmx.getc(e);
            var prop = e.currentTarget.getAttribute('data-prop');
            var elementId = e.currentTarget.getAttribute('data-elementid');
            c.deleteHashlistElement(prop, elementId);
        }
    },
    Util: {
        getOrigin: function(url) {
            var parser = document.createElement('a');
            parser.href = url;
            return parser.origin;
        },
        createNodeFromHTML: function(html) {
            var div = document.createElement('div');
            div.innerHTML = html;
            return div.firstChild;
        },
        sortFactory: function(prop) {
            return function(a,b){ return a[prop].localeCompare(b[prop]); };
        },
        isHashlist: function(value) {
            return !!(value && value._orderedIds);
        },
        rand: function() {
            return Math.random().toString(36).substr(4);
        },
        getParentPropPath: function(propPath) {
            var pp = propPath.split('.');
            pp.pop();
            return pp.join('.');
        }
    }
}

/**
* Constructor function 'RemixContainer' for container creation
*/
function RemixContainer({
    url = null,
    element = null,
    properties = {},
    width = 800,
    height = 600,
    containerLog = false,
    remixLog = false,
    mode = 'none'
    }) {

        if (!url) {
            throw Error('app url is not specified');
        }
        if (!element) {
            throw Error('element is not specified');
        }

        // create unique session for this container
        this.sessionId = Rmx.Util.rand();
        element.setAttribute('data-ssid', this.sessionId);
        window.Rmx.Containers[this.sessionId] = this;

        this.appOrigin = Rmx.Util.getOrigin(url); // like 'http://localhost:3000/';
        this.schema = null;
        this.mode = mode;
        this.containerLog = containerLog;
        this.remixLog = remixLog;
        this.defaults = properties;
        this.screens = [];
        this.controlViews = [];
        this.properties = [];
        this.serializedProperties = {};
        this.selectedControlPanelIndex = -1;

        if (element.innerHTML.indexOf('<iframe') < 0) {
            element.className = 'remix_cnt';
            element.style.position = 'relative';
            element.style.margin = '0 auto';
            element.style.maxWidth = width+'px';
            element.style.height = height+'px';

            window.addEventListener("message", this.receiveMessage.bind(this), false);
            if (this.mode === 'edit') {
                this.createControlPanel(element);
            }
            this.createIframe(url, element, width, height);

            //if (lp !== 'no') {
                //TODO createPoweredLabel(e, l);
            //}
            //TODO initGA(e);
        }
}

/**
 * Create iframe for Remix application
 *
 * @param {string} url iframe src url
 * @param {HTMLElement} parentNode
 * @param {number} width
 * @param {number} height
 * @param {HTMLElement} recomWrapper
 * @returns {HTMLElement}
 */
RemixContainer.prototype.createIframe = function(url, parentNode, width, height, recomWrapper) {
    //TODO const panelElems = createRecommendationPanel(parentNode, width);
    var content = document.createElement('div');
    content.className = 'remix_content';
    var iframe = document.createElement('iframe');
    iframe.setAttribute('allowFullScreen', '');
    iframe.style.border = 0;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.maxWidth = width+'px';
    iframe.style.maxHeight = height+'px';
    iframe.style.overflow = 'hidden';
    var self = this;
    iframe.onload = function(event) {
        self.log('init message sent');
        self.width = width;
        self.height = height;
        self.content = content;
        self.parentNode = parentNode;
        self.iframe = iframe;
        //TODO
        // recomWrapper: panelElems.recomWrapper,
        // recomPanel: panelElems.recomPanel,
        // leftArrow: panelElems.leftArrow,
        // rightArrow: panelElems.rightArrow,
        // close: panelElems.close,
        // panelWidth: 0
        self.iframe.contentWindow.postMessage({
            method: 'init',
            initialSize: {
                width: self.width,
                height: self.height
            },
            mode: self.mode,
            log: self.remixLog
        }, self.appOrigin);
        //stat('TestixLoader','Iframe_Loaded');
    };
    iframe.src = url;
    content.appendChild(iframe);
    parentNode.appendChild(content);
    return iframe;
}

RemixContainer.prototype.receiveMessage = function({origin = null, data = {}, source = null}) {
    // In current "window" we may have many RemixContainers with many "receiveMessage" handlers, but window is the same!
    // Must check iframe source
    if (!this.iframe || this.iframe.contentWindow !== source ||
        origin !== this.appOrigin) {
        return;
    }
    this.log(data.method + ' message received. ', data);
    if (data.method === 'inited') {
        this.schema = data.schema;
        if (this.mode === 'edit') {
            this.renderEditor();
            this.renderJsonViewer();
        }
        this.iframe.contentWindow.postMessage({
            method: 'setsize',
            width: this.width,
            height: this.height
        }, this.appOrigin);
        if (this.defaults) {
            this.setData(this.defaults);
        }
        //TODO get css string from project in inited message
    }
    if (data.method === 'properties_changed') {
        // never user: data.added, data.changed, data.deleted
        //this.properties = this.properties.concat(data.added).sort(Rmx.Util.sortFactory('path'));
        // if using, TODO basic sync algorythm
        this.serializedProperties = JSON.parse(data.state);
        if (this.selectedControlPanelIndex === 0) {
            // editor selected - update editor
            this.renderEditor();
        }
    }
    if (data.method === 'serialized') {
        this.serializedProperties = JSON.parse(data.state);
    }
    if (data.method === 'screens_update') {
        //data.added, data.changed, data.deleted
        //TODO screens: basic sync algorythm
        if (this.mode === 'edit') {
            //if (this.screens.length === 0) this.screens = data.added;
            this.screens = this.syncScreens(this.screens, data.added, data.changed, data.deleted);
            this.renderScreenViewer(this.screens);
        }
    }
    // if (event.data.method === 'showRecommendations') {
    //     showRecommendation(event.source);
    // }
    // if (event.data.method === 'hideRecommendations') {
    //     hideRecommendation(event.source);
    // }
    if (event.data.method === 'shareDialog') {
        stat('TestixLoader','Share_Dialog_Open', event.data.provider);
    }
    if (event.data.method === 'setSize') {
        //TODO ?
        setSize(event.source, event.data.size);
    }
    //TODO many others
}

RemixContainer.prototype.setProperty = function(prop, value) {
    this.iframe.contentWindow.postMessage({
        method: 'setdata',
        data: {[prop]: value}
    }, this.appOrigin);
}

/**
 * Sync local screens with application
 * Application sent screen modifications: "added", "changed", "deleted" arrays
 */
RemixContainer.prototype.syncScreens = function(screens, added, changed, deleted) {
    if (added.length === 0 && changed.length === 0 && deleted.length === 0) {
        throw Error('No screen modifications');
    }
    var result = screens.splice(0);
    if (deleted.length > 0) {
        for (var i = 0; i < deleted.length; i++) {
            var s = this.getScreen(deleted[i].screenId, screens);
            if (s) {
                result.splice(i, 1);
            }
        }
    }
    if (added.length > 0) {
        //throw already exist
    }
    if (changed.length > 0) {

    }
    return result;
}

RemixContainer.prototype.getScreen = function(id, screens) {
    return (screens && screens.length > 0) ? screens.find( (s) => s.screenId === id) : null;
}

/**
* Sends the message with new data to app
*/
RemixContainer.prototype.setData = function(data) {
    this.log('setdata message sent');
    this.iframe.contentWindow.postMessage({
        method: 'setdata',
        data: data
    }, this.appOrigin);
}

RemixContainer.prototype.addHashlistElement = function(propertyPath, index, prototypeId) {
    this.log('addhashlistelement message sent');
    this.iframe.contentWindow.postMessage({
        method: 'addhashlistelement',
        propertyPath,
        index,
        prototypeId
    }, this.appOrigin);
}

RemixContainer.prototype.changePositionInHashlist = function(propertyPath, elementIndex, newElementIndex) {
    this.log('changepositioninhashlist message sent');
    this.iframe.contentWindow.postMessage({
        method: 'changepositioninhashlist',
        propertyPath,
        elementIndex,
        newElementIndex
    }, this.appOrigin);
}

RemixContainer.prototype.deleteHashlistElement = function(propertyPath, elementId) {
    this.log('deletehashlistelement message sent');
    this.iframe.contentWindow.postMessage({
        method: 'deletehashlistelement',
        propertyPath,
        elementId
    }, this.appOrigin);
}

// /**
// * Restart application with specified properties
// * @param {object} properties
// */
// RemixContainer.prototype.run = function(properties = {}) {
//     this.iframe.contentWindow.postMessage({
//         method: 'run',
//         properties: properties
//     }, this.appOrigin);
// }

RemixContainer.prototype.serialize = function() {
    return null;
}

RemixContainer.prototype.deserialize = function(json) {

}


// =========================================================================================================
// =========================================================================================================
// Ui Methods below
// =========================================================================================================
// =========================================================================================================

/**
* Creates control tab with some buttons
*/
RemixContainer.prototype.createControlPanel = function(parent) {
    const pane = document.createElement('div');
    pane.className = 'remix_ctrl_pane';
    pane.innerHTML = '<span class="remix_pane_btn" data-ssid="'+this.sessionId+'" onclick="Rmx.Actions.onEdit(event)">Edit</span><span class="remix_pane_btn" data-ssid="'+this.sessionId+'" onclick="Rmx.Actions.onJson(event)">Json</span><span class="remix_pane_btn js-viewScreens">Screens</span><span class="remix_pane_btn"  data-ssid="'+this.sessionId+'" onclick="Rmx.Actions.onClose(event)">[X]</span>';
    parent.appendChild(pane);
}

RemixContainer.prototype.selectControlPanelItem = function(itemIndex) {
    this.selectedControlPanelIndex = itemIndex;
    for (var i = 0; i < this.controlViews.length; i++) {
        if (i === itemIndex) {
            this.controlViews[i].style.display = 'block';
        }
        else {
            this.controlViews[i].style.display = 'none';
        }
    }
}

RemixContainer.prototype.renderLine = function(name, value, depth, isHashlist, isHashlistElement, propPath) {
    depth = depth || 0;
    var html = '', htControls = '';
    if (isHashlist) {
        htControls += '<span onclick="Rmx.Actions.onHLAdd(event)" data-prop="'+propPath+'" data-ssid="'+this.sessionId+'"">[+]</span>';
    }
    if (isHashlistElement) {
        htControls += '<span onclick="Rmx.Actions.onHLEDelete(event)" data-prop="'+Rmx.Util.getParentPropPath(propPath)+'" data-ssid="'+this.sessionId+'" data-elementid="'+name+'">[-]</span>';
    }
    html += '<tr><td><span style="padding-left:'+(depth*10)+'px">'+htControls+'</span>'+name+'</td><td>';
    if (value) {
        html += '<input value=\"'+value+'\"/ onfocusout="Rmx.Actions.setProperty(event)" data-prop="'+propPath+'" data-ssid="'+this.sessionId+'"></td></tr>';
    }
    return html;
}

RemixContainer.prototype.renderBlock = function(properties, blockName, depth, propPath, isHashlistElement) {
    var html = '';
    blockName = blockName || '';
    propPath = (propPath) ? (propPath + '.') : '';
    for (var key in properties) {
        if (key === '_orderedIds') continue;
        if (properties.hasOwnProperty(key)) {
            if (typeof properties[key] === 'object') {
                var isHashlist = Rmx.Util.isHashlist(properties[key]);
                html += this.renderLine(key, undefined, depth, isHashlist, isHashlistElement, propPath + key);
                html += this.renderBlock(properties[key], '', depth+1, propPath + key, isHashlist === true);
            }
            else
                html += this.renderLine(key, properties[key], depth+1, isHashlist, isHashlistElement, propPath + key);
        }
    }
    return html;
}

/**
* Creates simple mini editor
*/
RemixContainer.prototype.renderEditor = function() {
    var editorHtml = this.renderBlock(this.serializedProperties, '', 0, '', false)
    editorHtml = "<table><thead><tr><th>Property</th><th>Value</th></tr></thead><tbody>"+editorHtml+"</tbody></table>"
    if (!this.editorNode) {
        this.editorNode = Rmx.Util.createNodeFromHTML('<div class="remix_micro_editor" style="display:none"></div>');
        this.content.appendChild(this.editorNode);
        this.controlViews.push(this.editorNode);
    }
    this.editorNode.innerHTML = editorHtml;
}

RemixContainer.prototype.renderJsonViewer = function() {
    if (!this.jsonViewerNode) {
        this.jsonViewerNode = Rmx.Util.createNodeFromHTML('<div class="remix_micro_editor" style="display:none;white-space:inherit"></div>');
        this.content.appendChild(this.jsonViewerNode);
        this.controlViews.push(this.jsonViewerNode);
    }
    this.jsonViewerNode.innerHTML = JSON.stringify(this.serializedProperties);
}

/**
 * Renders application screen previews
 */
RemixContainer.prototype.renderScreenViewer = function(screens) {
    if (!this.screenViewerNode) {
        // build screen preview interface
        this.screenViewerNode = Rmx.Util.createNodeFromHTML('<div class="remix_micro_editor" style="display:none"></div>');
        this.screenBtnPanel = Rmx.Util.createNodeFromHTML('<div class="remix_scr_pane"></div>');
        this.screenViewerNode.appendChild(this.screenBtnPanel);
        this.screenIframe = Rmx.Util.createNodeFromHTML(this.getIframeCodeForScreenPreview(this.width, this.height));
        this.screenViewerNode.appendChild(this.screenIframe);
        this.content.appendChild(this.screenViewerNode);
        this.controlViews.push(this.screenViewerNode);
        // iframe loaded, now we can add smthing to document
        this.screenContainer = Rmx.Util.createNodeFromHTML('<div id="screen_container"></div>');
        var iframedoc = this.screenIframe.contentDocument || this.screenIframe.contentWindow.document;
        iframedoc.body.appendChild(this.screenContainer);
        var style = document.createElement('style');
        //TODO get css string from build/statix/css/main
        style.type = 'text/css';style.appendChild(document.createTextNode('body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,Fira Sans,Droid Sans,Helvetica Neue,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}code{font-family:source-code-pro,Menlo,Monaco,Consolas,Courier New,monospace}p{margin:0;padding:0}.eng-app,.eng-screen{background-color:#eee}.eng-screen{min-width:100px;min-height:40px}.eng-quiz-slide{width:100%;border:1px solid #000}'))
        iframedoc.body.appendChild(style);
        var self = this;
        document.querySelector('.js-viewScreens').addEventListener("click", function() {
            self.selectControlPanelItem(2); // 2 index - third tab "Screens"
        });
    }
    var html = '';
    // update buttons every time
    for (var i = 0; i < screens.length; i++) {
        html += '<button class="remix_scr_tab js-scr_'+screens[i].screenId+'" data-scr="'+screens[i].screenId+'">'+screens[i].screenId+'</button>';
    }
    this.screenBtnPanel.innerHTML = html;
    // attach listener to buttons
    for (var i = 0; i < screens.length; i++) {
        document.querySelector('.js-scr_'+screens[i].screenId).addEventListener("click", this.onScrBtnClick.bind(this, screens[i].screenId));
    }
    //TODO clear prev handlers
    if (screens.length > 0) {
        this.showScreen(screens[0].screenId);
    }
}

RemixContainer.prototype.onScrBtnClick = function(screenId) {
    this.showScreen(screenId);
}

RemixContainer.prototype.showScreen = function(screenId) {
    for (var i = 0; i < this.screens.length; i++) {
        if (screenId === this.screens[i].screenId) {
            // var iframe = this.screenContainer.firstChild;
            // var iframedoc = iframe.contentDocument || iframe.contentWindow.document;
            // iframedoc.body.appendChild = '<div>'+this.screens[i].markup+'</div>';
            this.screenContainer.innerHTML = '<div>'+this.screens[i].markup+'</div>';
            break;
        }
    }
}

RemixContainer.prototype.getIframeCodeForScreenPreview = function(width, height) {
    return '<iframe width="'+width+'px" height="'+height+'px" style="border:0;width:100%;height:100%;max-width:'+width+'px;max-height:'+height+'px"></iframe>';
}

// =========================================================================================================
// =========================================================================================================
// Helper Methods below
// =========================================================================================================
// =========================================================================================================

RemixContainer.prototype.stat = function() {
    //TODO
}

RemixContainer.prototype.log = function(...message) {
    if (this.containerLog) {
        console.log('RContainer:', ...message);
    }
}

export default RemixContainer
//module.exports = RemixContainer;
