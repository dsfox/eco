var debug = false;
var tabs_in_action = {}; // tab store
var tabs_in_action_clear_timer; //pointer;
var tabs_in_action_clear_interval = 1 * 60 * 1000; //1 min
var default_whitelist = ["http://yandex.ru/yandsearch", "https://yandex.ru/yandsearch", "https://www.google.ru", "https://www.google.com"];
var enabled = localStorage.getItem("enabled") == "true";
var whitelist = localStorage.getItem("whitelist");
if (enabled === null) {
  enabled = true;
}
if (!whitelist) {
  whitelist = default_whitelist;
}

function inWhitelist(url) {
  for (var i in whitelist) {
    console.log(url + " == " + whitelist[i]);
    if (url.indexOf(whitelist[i]) == 0) {
      console.log("match");
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

function liteNormalize(url, slash) {
  //cut to path
  if (url.indexOf("?") > 0) {
    url = url.substr(0, url.indexOf('?'));
  } else {
    url = url.substr(0, url.lastIndexOf("/"));
  }
  if (slash) {
    if (url.charAt(url.length - 1) == "/") {
      url = url.slice(0, url.length - 1);
    }
  } else {
    if (url.charAt(url.length - 1) != "/") {
      url += "/";
    }
  }
  return url;
}

function eco(boss, active, opener) { //no opener dependencies yet
  var params = {
    selected: true
  };
  debug && console.log("boss.url == active.url : " + (boss.url == active.url));
  if (boss.url != active.url) {
    params.url = active.url;
  }
  debug && console.log("boss == active : " + (boss.id == active.id));
  if (boss.id != active.id) {
    if (inWhitelist(boss.url)) {
      debug && console.log("whitelisted", boss.url);
      return;
    }
    try {
      delete tabs_in_action["tab" + active.id];
      delete tabs_in_action["tab" + boss.id];
    } catch (e) {
      debug && console.log("unable to delete ids", active.id, boss.id);
    }
    chrome.tabs.update(boss.id, params);
    chrome.tabs.remove(active.id);
  }
}

function collapseAll() {
  function callback(result) {
    var tab, url;
    var bossTabs = {};
    if (result && result.length > 0) {
      for (var i in result) {
        tab = result[i];
        url = liteNormalize(tab.url, true);
        console.log("url: " + url)
        if (!bossTabs[url]) {
          bossTabs[url] = tab;
          tabs_in_action["tab" + tab.id] = Date.now();
          /*} else if (inWhitelist(url)) {
          debug && console.log("whitelisted", active.url); */
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
    debug && console.log("cleaning... ", tabs_to_delete);
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

function onTabCreated(tab) {
  if (!enabled) {
    return;
  }
  var url = liteNormalize(tab.url, true);
  var attempt = 2;
  url += "*";
  debug && console.log("queryInfo: url : " + url);
  var queryInfo = {
    'url': url
  };
  tabs_in_action["tab" + tab.id] = Date.now();

  function callback(result) {
    var tabs, boss, active, openerId;
    if (result.length == 0) {
      attempt--;
      if (attempt > 0) {
        url = liteNormalize(tab.url, false);
        url += "*";
        queryInfo = {
          'url': url
        };
        chrome.tabs.query(queryInfo, callback);
      }
    }
    if (result && result.length > 0) {
      tabs = getBossAndActiveTabs(result);
      debug && console.log('tabs', tabs);
      boss = tabs.boss;
      active = tabs.active;
      if (active) {
        openerId = active.openerTabId;
      } else {
        active = boss;
      }
      if (openerId) {
        chrome.tabs.get(openerId, function(tab) {
          eco(boss, active, tab);
        });
      } else {
        eco(boss, active, null);
      }
    }
  }
  chrome.tabs.query(queryInfo, callback);

}
chrome.tabs.onCreated.addListener(onTabCreated);
chrome.tabs.onUpdated.addListener(onTabUpdate);

//toolbar button actions

function iconOnClick(tab) {
  enabled = !enabled;
  localStorage.setItem("enabled", true);
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