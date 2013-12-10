var tabs_in_action = {}; // tab store
var tabs_in_action_clear_timer; //pointer;
var tabs_in_action_clear_interval = 1 * 60 * 1000; //1 min
var default_whitelist = ["http://yandex.ru/yandsearch", "https://yandex.ru/yandsearch", "https://www.google.ru/#", "https://www.google.com/#"];
var enabled = localStorage.getItem("enabled") != "false";
var whitelist = localStorage.getItem("whitelist");

if (!whitelist) {
  whitelist = default_whitelist;
}

function inWhitelist(url) {
  for (var i in whitelist) {
    if (url.indexOf(whitelist[i]) == 0) {
      return true;
    }
  }
  return false;
}

function getBossAndActiveTabs(tabs) {
  var boss, active;
  for (var i in tabs) {
    if (tabs[i]) {
      if (boss == null && active == null) {
        boss = tabs[i];
        active = tabs[i];
      }
      if (tabs[i].id < boss.id) {
        boss = tabs[i];
      }
      if (tabs[i].id > active.id) {
        active = tabs[i];
      }
    }
  }
  return {
    'boss': boss,
    'active': active
  };
}

function eco(boss, active, opener) { //no opener dependencies yet
  var params = {
    selected: true,
    active: true
  };
  if (boss.url != active.url) {
    params.url = active.url;
  }
  if (boss.id != active.id) {
    if (inWhitelist(boss.url)) {
      return;
    }
    try {
      delete tabs_in_action["tab" + active.id];
      delete tabs_in_action["tab" + boss.id];
    } catch (e) {}
    chrome.tabs.remove(active.id);
    chrome.tabs.update(boss.id, params);
    chrome.tabs.move(boss.id, {
      index: -1
    });
  }
}

function collapseAll() {
  function callback(result) {
    var tab, uri, url;
    var bossTabs = {};
    if (result && result.length > 0) {
      for (var i in result) {
        tab = result[i];
        uri = new URI(tab.url);
        url = uri.protocol() + '://' + uri.host() + uri.path();
        if (!bossTabs[url]) {
          bossTabs[url] = tab;
          tabs_in_action["tab" + tab.id] = Date.now();
        } else {
          if (tab.active) {
            chrome.tabs.update(bossTabs[url].id, {
              'url': tab.url,
              'selected': true
            });
          }
          chrome.tabs.remove(tab.id);
        }
      }
    }
    delete bossTabs;
  }
  chrome.tabs.query({}, callback);
}

function clearTabsInAction() {
  var ts, tabs_to_delete = [];
  var now = Date.now();
  for (var tab in tabs_in_action) {
    ts = tabs_in_action[tab];
    if ((now - ts) > tabs_in_action_clear_interval) {
      tabs_to_delete.push(tab);
    }
  }
  for (var i in tabs_to_delete) {
    delete tabs_in_action[tabs_to_delete];
  }
}

function onTabUpdate(tabId, changes, tab) {
  if (!enabled) {
    return;
  }
  if (tabs_in_action.hasOwnProperty("tab" + tabId)) {
    onTabCreated(tab);
  }
}

function smartFilter(url1, url2) {
  var uri1 = new URI(url1);
  var uri2 = new URI(url2);
  var rule1 = uri1.protocol() != uri2.protocol();
  var rule2 = uri1.host() != uri2.host();
  var rule3 = uri1.path() != uri2.path();
  return !(rule1 || rule2 || rule3);
}

function onTabCreated(tab) {
  if (!enabled) {
    return;
  }
  var uri = new URI(tab.url);
  var url = uri.protocol() + '://' + uri.host() + uri.path();
  var queryInfo = {
    'url': (url + "*")
  };

  tabs_in_action["tab" + tab.id] = Date.now();

  function callback(result) {
    var tabs, boss, active, pre_tabs = [];
    if (result && result.length > 0) {
      for (var i in result) {
        if (smartFilter(url, result[i].url)) {
          pre_tabs.push(result[i]);
        }
      }
      tabs = getBossAndActiveTabs(pre_tabs);
      boss = tabs.boss;
      active = tabs.active;
      if (active &&
        active.windowId != boss.windowId &&
        active.url.indexOf("chrome://newtab") == 0 &&
        active.index == 0) {
        return;
      }
      eco(boss, active, null);
    }
  }
  chrome.tabs.query(queryInfo, callback);

}
chrome.tabs.onCreated.addListener(onTabCreated);
chrome.tabs.onUpdated.addListener(onTabUpdate);

//toolbar button actions

function iconOnClick(tab) {
  enabled = !enabled;
  localStorage.setItem("enabled", enabled);
  updateState(false);
}

function updateState(firstRun) {
  var icon = enabled ? "icon38.png" : "icon38off.png";
  var details = {
    'path': icon
  };

  chrome.browserAction.setIcon(details, function() {});
  clearInterval(tabs_in_action_clear_timer);
  if (enabled) {
    tabs_in_action_clear_timer = setInterval(clearTabsInAction, tabs_in_action_clear_interval);
    if (!firstRun) {
      collapseAll();
    }
  } else {
    clearTabsInAction();
  }
}
updateState(true);

chrome.browserAction.onClicked.addListener(iconOnClick);