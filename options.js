var whitelist;
var default_protocol = "http://";
var list = localStorage.getItem("whitelist");

if (list && typeof list == "string") {
    list = list.replace(/,/g, '\n');
}

var sites = document.getElementById("sites");
sites.addEventListener("change", onChange, false);
sites.innerHTML = list;

var title = document.getElementById("options_text1");
title.innerHTML = chrome.i18n.getMessage("options_text1");

var buttonClose = document.getElementById("options_close");
buttonClose.value = chrome.i18n.getMessage("options_close");
buttonClose.addEventListener("click", onClose, false);

//listeners

function onChange(event) {
    try {
        whitelist = event.target.value.replace(/ /g, '').split('\n');
        normalizeWhitelist();
    } catch (e) {}
}

function normalizeWhitelist() {
    var site;
    try {
        for (var i in whitelist) {
            site = new URI(whitelist[i]);
            if (site.protocol() == '') {
                whitelist[i] = default_protocol + whitelist[i];
            }
        }
    } catch (e) {
        console.log("normalizeWhitelist FAIL", e);
    }
}

function onClose(event) {
    if (whitelist) {
        localStorage.setItem("whitelist", whitelist);
        chrome.runtime.sendMessage({
            "options": "updated"
        });
    }
    window.close();
}