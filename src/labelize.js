import sketch from 'sketch'
// documentation: https://developer.sketchapp.com/reference/api/
import BrowserWindow from 'sketch-module-web-view'
import jsonResult from './globals.js'
import helpers from './helpers.js'
import fileHelper from './fileHelper.js'

const options = {
  identifier: 'mainWindow',
  webPreferences: {
    javascript: true,
    devTools: true
  },    
  closable: true,
  width: 1024, 
  height: 860,
  show: false
}
const optionsReadMe = {
    identifier: 'readMeWindow',
    webPreferences: {
      javascript: true,
      devTools: true
    },    
    frame: true,
    width: 800, 
    height: 800 ,
    show: false
  }
var browserWindow;
var workspace;


var jsonModify = {};

var prefixer = "";
var currentObject = null;
var currentPage = "";
var countRadioButton = 0;
var countNotif= 0;
var sharedLabels= ['tab', 'title', 'NextButton', 'BackButton'];
var skipLabels = ['Nav bar'];
var duplicates = [];

export default function() {

 browserWindow =   new BrowserWindow(options);
  browserWindow.loadURL(require('./ui.html'));
  browserWindow.once('ready-to-show', () => {
        browserWindow.show();
    })
  workspace = NSWorkspace.alloc().init();
  helpers.init(browserWindow);
  browserWindow.webContents.on('extractLabel', (index) => {
    helpers.sendMessage('notification', 'green;Sketch extraction started...');
    start(index);
    helpers.sendMessage('notification', 'green;Sketch extraction ended...');
  });  

  browserWindow.webContents.on('downloadFile', param => {
    var st = "";
    var path = param[3] ? NSString.stringWithFormat("%@",param[3]) : null;

    var result = fileHelper.writeTextToFile(
        param[2] === 'csv' ? NSString.stringWithFormat("%@", param[0]) : param[0], path+param[1]+"."+param[2], param[2]);
    sketch.UI.message(result);

    helpers.sendMessage("notification","green;Download completed!");
  });

  browserWindow.webContents.on('initializePages', () => {
    let pages = "";
    for(let i=0, length = context.document.pages().length; i < length; i+=1){
        pages += context.document.pages()[i].name() + (i < length -1 ? ';' : '');
    }
    sketch.UI.message(pages);
    try{
        helpers.sendMessage("initPages", pages);
    } catch(e){
        sketch.UI.message(e);
    }
  });

  browserWindow.webContents.on('translate', (labels) => {
    sketch.UI.message("translation:"+labels.index);
    translatePage(labels.index, labels.json);
  });

  browserWindow.webContents.on('importFile', () => {
    var json = importFile();
    if(json+"" === "0") {
        return;
    }
    if(json+"" === "-1") {
        try{
            helpers.sendMessage('notification', 'red;Error while importing the file');
        } catch(e) {
            console.log(e);
        }
        return;
    }
    for (var k in json){
        try{
            let key = k+"";
            let value = json[k]+"";
         helpers.sendMessage('insertNewLabel', key+";"+value);
        } catch(e) {
            helpers.sendMessage('log', 'error during insert');
        }
    }
    try {
        helpers.sendMessage('displayLabels', "1");
    } catch (e) {
        helpers.sendMessage('log', 'error during display');
    }
    try {
        helpers.sendMessage("notification","green;import completed!");
    } catch (e) {
        helpers.sendMessage('log', 'error during notif');
    }
    return;
  });

  browserWindow.webContents.on('location', () => {
    selectFolder();
  });

  browserWindow.webContents.on('openReadMe', () => {
    const readMeWindow = new BrowserWindow(optionsReadMe);
    readMeWindow.loadURL(require('./readMe.html'));
    
    readMeWindow.once('ready-to-show', () => {
    readMeWindow.focus();
    readMeWindow.show();
    });
  });
}

function start(index) {
    let jsonResult = {};
    const layers = context.document.pages()[index].layers();
    try {
    parseArray(layers);  
    } catch (e) {
        helpers.sendMessage('log', 'error on parseArray');
    }
    helpers.sendMessage("displayLabels","");
}

function selectFolder() {
    var fileTypes = ["json", "csv"];
    const panel = NSOpenPanel.openPanel();
    panel.setAllowsMultipleSelection(0);
    panel.setCanChooseDirectories(1);
    panel.setCanChooseFiles(0);
    panel.setFloatingPanel(1);
    panel.setMessage("Choose target location");
    var result = panel.runModalForDirectory_file_types(nil, nil, fileTypes);
    if (result != NSOKButton) {
        return 0;
    }
    if (panel.URLs().count() < 1) {
        return 0;
    }
    let path = panel.URLs()[0] + "";
    path = path.replace(/(%20)/g, ' ');
    helpers.sendMessage('targetLocation', path);
}

function importFile() {
    var fileTypes = ["json", "csv"];
    const panel = NSOpenPanel.openPanel();
    panel.setAllowsMultipleSelection(0);
    panel.setCanChooseDirectories(0);
    panel.setCanChooseFiles(1);
    panel.setFloatingPanel(1);
    panel.setMessage("Choose file");
    var result = panel.runModalForDirectory_file_types(nil, nil, fileTypes);
    if (result != NSOKButton) {
        return 0;
    }
    if (panel.URLs().count() < 1) {
        return -1;
    }
    let path = panel.URLs()[0] + "";
    const isJson = path.indexOf('.json') > -1;
    var jsonObject =  isJson? fileHelper.jsonFromFile(panel.URLs()[0], true) : fileHelper.readTextFromFile(panel.URLs()[0]) + "";
    let jsonRead = {};
    let filename = "test";

    try {
        if(isJson) {
            filename = path.split('.json')[0].split('/');
            filename = filename[filename.length-1];
            for (var k in jsonObject) {
                jsonRead[k] = jsonObject[k+""] + "";
            }
        } else {
            filename = path.split('.csv')[0].split('/');
            filename = filename[filename.length-1];
            jsonObject = jsonObject.split('\n');
            let kv = '';
            for (var k in jsonObject) {
                let key = k+""
                if(k !== '0' ) {
                    kv = jsonObject[k].split(';');
                    if(kv[0]+"" !== "");
                    jsonRead[kv[0]+""] = kv[1] + "";
                }
            }
        }
    } catch (e) {
        helpers.sendMessage('notification', 'error during import of ' + path);
    }
    helpers.sendMessage('setFileName', filename);
    return jsonRead;
}

function translatePage(index, json) {
    const layers = context.document.pages()[index].layers();
    let currentPage = "";
    let jsonParsed = {};
    try {
        jsonParsed = JSON.parse(json);
    } catch(e){  
      sketch.UI.message("error "+e);
      return;
    }
    parseArray(layers, jsonParsed, currentPage, null); 

    helpers.sendMessage("notification","green;Translation completed!");
}

var re = new RegExp("[A-Z0-9]{8}[-][A-Z0-9]{4}[-][A-Z0-9]{4}[-][A-Z0-9]{4}[-][A-Z0-9]{12}");

function parseArray(array, jsonP, currentPage, currentSymbol) {
  let count = 0;
  let currentItem;
  
  array.forEach((item) => {
    currentItem = sketch.fromNative(item);
    if(jsonP) {
        translateItem(currentItem, jsonP, currentPage, currentSymbol);
    } else {
        parseItem(currentItem, count, currentPage, currentSymbol);
    }
    count += 1;
  });
}

function parseItem(item, count,currentPage, currentSymbol){
    if(`${item.name}`.indexOf('[x]') > -1) {
        return;
    }
  let json = {};
  console.log(item.type+"");
  switch(item.type){
      case "Artboard": 
      case "SymbolMaster":
        currentPage = helpers.format(item.name+"").split('-')[0].replace(/\r?\n|\r/g,' ').replace(/;/g,',').trim();
        parseArray(item.sketchObject.layers(), null, currentPage, currentSymbol);
        break;
      case "SymbolInstance": 
        currentSymbol = item.name + "";
        currentSymbol = currentSymbol.replace(/\r?\n|\r/g,' ').replace(/;/g,',').trim(); 
        parseArray(item.overrides, null, currentPage, currentSymbol);
        break;
      case "Text": 
        try {
            let value = item.sketchObject.stringValue()+"";
           
            value = value.replace(/\r?\n|\r/g, ' ');
            helpers.sendMessage('insertNewLabel',currentPage + "__" + item.name + ";"+helpers.sanitize(value));
        } catch(e) {
            helpers.sendMessage('log', 'error while retrieving text for' + item.name);
        }
        break;
      case "Group":
        if(item.sketchObject.layers().length > 0)
            parseArray(item.sketchObject.layers(), null, currentPage, currentSymbol);
        break;
      case "Override":
      case "OverriddeValue":
        try {
            var itemV = item.value + "";
            itemV = itemV.replace(/\r?\n|\r/g, ' ').replace(/;/g, ',').replace(/\"/g,'\\"').trim();
            const regex = new RegExp("[A-Z0-9]{8}[-][A-Z0-9]{4}[-][A-Z0-9]{4}[-][A-Z0-9]{4}[-][A-Z0-9]{12}");
            if(!regex.test(itemV) && itemV !== '') {
                helpers.sendMessage('insertNewLabel',currentPage+"__"+helpers.getNameForItem(currentSymbol+"")+"_"+item.affectedLayer.name + ";"+itemV);
            }
         } catch (e) {
            helpers.sendMessage('log', 'error while retrieving text for '+ currentSymbol);
        }
        break;
      case "Layers": 
        parseArray(item.sketchObject.layers(), null, currentPage, currentSymbol);
  }
}

function translateItem(item, jsonT, currentPage, currentSymbol){
    if(`${item.name}`.indexOf('[x]') > -1) {
        return;
    }
    switch(item.type){
        case "Artboard": 
        case "SymbolMaster":
            currentPage = helpers.format(item.name+"").split('-')[0].replace(/\r?\n|\r/g,' ').replace(/;/g,',').trim();
            parseArray(item.sketchObject.layers(), jsonT, currentPage, currentSymbol);
            break;
        case "SymbolInstance": 
            currentSymbol = item;
            parseArray(item.overrides, jsonT, currentPage, currentSymbol);
            break;
        case "Text":   
            let key =  currentPage + "__" + item.name;
            
            let value = jsonT[key] + "";
            if(typeof jsonT[key] === 'undefined') {
                value = jsonT[item.name+""];
            }
            if(typeof value !== 'undefined') {
                item.sketchObject.replaceTextPreservingAttributeRanges(""+value);
            }
            break;
        case "Group":
        if(item.sketchObject.layers().length > 0)
            parseArray(item.sketchObject.layers(), jsonT, currentPage, currentSymbol);
            break;
        case "Override":
        case "OverriddeValue":
        const regex = new RegExp("[A-Z0-9]{8}[-][A-Z0-9]{4}[-][A-Z0-9]{4}[-][A-Z0-9]{4}[-][A-Z0-9]{12}");
        if(!regex.test(item.value)) {
            if(typeof jsonT[currentPage+"__"+helpers.getNameForItem(currentSymbol.name)+"_"+item.affectedLayer.name] !== 'undefined'){
                item.value = jsonT[currentPage+"__"+helpers.getNameForItem(currentSymbol.name)+"_"+item.affectedLayer.name];
            } else if( typeof jsonT[currentPage+"__"+helpers.getNameForItem(currentSymbol.name)] !== 'undefined'){
                item.value = jsonT[currentPage+"__"+helpers.getNameForItem(currentSymbol.name)];
            }
            else if (typeof jsonT[helpers.getNameForItem(currentSymbol.name)] !== 'undefined'){
                item.value = jsonT[helpers.getNameForItem(currentSymbol.name)];
            }
            
        }
            break;
        case "Layers": 
          parseArray(item.sketchObject.layers(), jsonT, currentPage, currentSymbol);
    }
}

