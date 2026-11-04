const options = {
  consent: '',
  contextnumber: 3,
  maxplaces: 100
};
const settings = {
  'latitude': 37.422388,
  'longitude': -122.0841883,
  'location': "Google Building 40, Amphitheatre Parkway, Mountain View, CA, USA",
  'name': "Google Building 40",
  'placeId': "ChIJj38IfwK6j4ARNcyPDnEGa9g",
  'enabled': false,
  'hl': 'en',
  'gl': 'US',
  'regions': 'United States - English'
};
const knownPlaces = [settings];
var gsMenuIds = []; // عناصر القائمة السياقية بتاعتنا — نمسحها بس عند إعادة البناء

// v1.21.0: المستمع كان بيتسجل من جديد مع كل setupContextMenu — تكرار قوائم = تكرار
// كليك (تخزينات ورا بعض) وتسريب مستمعين؛ يتسجل مرة واحدة في عمر الـWorker
chrome.contextMenus.onClicked.addListener(genericOnClick);
// v1.21.0: قواعد session بتموت مع إعادة تشغيل/تحديث كروم — نعيد تطبيقها عند التحديث
chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get(['settings'], (data) => {
    if (data.settings) { Object.assign(settings, data.settings); }
    checkEnabled();
  });
});

chrome.runtime.onStartup.addListener(function() {
  chrome.storage.local.get(null, (data) => {
    if (data.settings) {
      Object.assign(settings, data.settings);
      checkEnabled();
    }
    if (data.options) {
      Object.assign(options, data.options);
    }
    if (data.knownPlaces) {
      // v1.21.0: استبدال نضيف — Object.assign على مصفوفة كان بيسيب عناصر ميتة من نسخ أقدم
      knownPlaces.length = 0;
      Array.prototype.push.apply(knownPlaces, data.knownPlaces);
      setupContextMenu(knownPlaces);
    }
  });
});

function genUULE() {
  var lat = Math.floor(settings.latitude*1e7) || 525109360;
  var lng = Math.floor(settings.longitude*1e7) || 134104990;
  // v1.21.6: قطر قابل للضبط — «السعودية كلها» بيذرعه ديفولت الأدوات المدمجة بـ1000كم،
  // وأي مدينة يختارها المستخدم من Places بتفضل على الـ65كم التاريخي بتاع الجهاز
  var rad = parseInt(settings.radius, 10) || 65000;
  var decodedXgeo = 'role: CURRENT_LOCATION\nproducer: DEVICE_LOCATION\nradius: '+rad+'\nlatlng <\n  latitude_e7: '+lat+'\n  longitude_e7: '+lng+'\n>';
  var encodedXgeo = 'a '+btoa(decodedXgeo);
  return encodedXgeo
}

function genAcceptLanguage() {
  return `${settings.hl}-${settings.gl}`;
}

function checkEnabled() {
  // v1.21.40 ط¹: gs Location كان بيغيّر الهيدر على google.com بس (urlFilter ثابت)،
  // بينما الأداة الأم بتفتح بحث السعودية على google.com.sa — يعني الرفيق المكاني
  // كان **مش بيلمس الصفحات اللي بنفحصها**. بقى فيه قاعدتين: .com و.com.sa.
  if (settings.enabled) {
    // الأيقونة ملك الإضافة الموحدة — لا نغيّرها من أدوات مدمجة
    chrome.declarativeNetRequest.updateSessionRules(
      {
        removeRuleIds: [
          1,2,3
        ],
        addRules: [
          {
            "id": 1,
            "priority": 1,
            "action": {
              "type": "modifyHeaders",
              "requestHeaders": [
                {
                  "header": "x-geo",
                  "operation": "set",
                  "value": genUULE()
                },
                {
                  "header": "accept-language",
                  "operation": "set",
                  "value": genAcceptLanguage()
                }
              ]
            },
            "condition": {
              // v1.21.0: التصعيد كان على كل طلب google.com (صور/XHR/pings) — هيدر غريب
              // على كل حاجة = بصمة بتخلي جوجل ريّب فينا؛ كفاية صفحات النتائج نفسها
              "urlFilter": "google.com/search",
              "resourceTypes": [
                "main_frame",
                "sub_frame"
              ]
            }
          },
          {
            // v1.21.40: نفس الهيدرين على الدومين السعودي اللي الأداة الأم بتستخدمه
            "id": 2,
            "priority": 1,
            "action": {
              "type": "modifyHeaders",
              "requestHeaders": [
                {
                  "header": "x-geo",
                  "operation": "set",
                  "value": genUULE()
                },
                {
                  "header": "accept-language",
                  "operation": "set",
                  "value": genAcceptLanguage()
                }
              ]
            },
            "condition": {
              "urlFilter": "google.com.sa/search",
              "resourceTypes": [
                "main_frame",
                "sub_frame"
              ]
            }
          }
        ]},() => {
          if (chrome.runtime.lastError) {
            console.log(chrome.runtime.lastError.message);
          }
        }
    );
  } else {
    chrome.declarativeNetRequest.updateSessionRules(
      {
        removeRuleIds: [1, 2],
        // v1.21.40: كان بيمسح 1 بس وسايب 2 (rule .com.sa الجديدة) معلقة —
        // وضع «إيقاف الموقع» كان بيسيب التمويه شغال. الاتنين بيتشالوا.
        addRules: []
      },
      () => {
        if (chrome.runtime.lastError) {
          console.log(chrome.runtime.lastError.message);
        }
      }
    );
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  // v1.21.40: 🔴 الشرط ده كان `area !== 'sync'` — وكل كاتبي الإعدادات في الأداة
  // (popup.js، options.js، وembedded.js) بيكتبوا في `local`. يعني أي تغيير في الموقع
  // أو gl/hl من واجهة gs Location **مكانش بيوصل للخلفية أبدًا**: القواعد بتفضل على
  // الإعداد القديم لحد أول إعادة تشغيل لكروم، والمستخدم شايف «اتحفظ» وهو مش شغال.
  if (area !== 'local') {
    return;
  }
  if (changes.settings && changes.settings.newValue) {
    Object.assign(settings, changes.settings.newValue);
    checkEnabled();
    setupContextMenu(knownPlaces);
  }
  if (changes.options && changes.options.newValue) {
    Object.assign(options, changes.options.newValue);
  }
  if (changes.knownPlaces && Array.isArray(changes.knownPlaces.newValue)) {
    // تطهير نضيف — Object.assign على مصفوفة بيسيب شوائب (نفس درس 1.21.0)
    knownPlaces.length = 0;
    Array.prototype.push.apply(knownPlaces, changes.knownPlaces.newValue);
    setupContextMenu(knownPlaces);
  }
});

var parent = chrome.contextMenus.create({
  "title": "change location",
  "id": "window"
}, () => chrome.runtime.lastError);
chrome.contextMenus.create({
  "title": "🚫 disable fake location",
  "id": "disable",
  "parentId": parent
  //,"onclick": genericOnClick
}, () => chrome.runtime.lastError);

function compareTimestamp(a, b) {
  if (!a.timestamp || !b.timestamp) {
    return 0;
  } else {
    return a.timestamp - b.timestamp;
  }
}
function setupContextMenu(allPlaces) {
  var contextPlaces = allPlaces.sort(compareTimestamp).slice(Math.max(allPlaces.length - options.contextnumber, 0));
  // إزالة عناصرنا بس (من غير removeAll عشان ما نمسحش قوائم الأدوات التانية في الإضافة الموحدة)
  ['window', 'disable', 's1', 's2'].forEach(function (id) {
    chrome.contextMenus.remove(id, () => chrome.runtime.lastError);
  });
  gsMenuIds.forEach(function (id) { chrome.contextMenus.remove(id, () => chrome.runtime.lastError); });
  gsMenuIds = [];
  parent = chrome.contextMenus.create({"title": "change location", "id": "window"}, () => chrome.runtime.lastError);
  chrome.contextMenus.create({"title": "🚫 disable fake location", "id": "disable","parentId": parent}, () => chrome.runtime.lastError);
  chrome.contextMenus.create({"type": "separator", "id": "s1", "parentId": parent}, () => chrome.runtime.lastError);
  if (settings.enabled && settings.location) {
    gsMenuIds.push(String(settings.placeId));
    chrome.contextMenus.create({"title": "📍"+settings.location, "id": String(settings.placeId), "parentId": parent}, () => chrome.runtime.lastError);
    chrome.contextMenus.create({"type": "separator", "id": "s2", "parentId": parent}, () => chrome.runtime.lastError);
  } else {
    if (settings.location) {
      gsMenuIds.push(String(settings.placeId));
      chrome.contextMenus.create({"title": settings.location, "id": String(settings.placeId), "parentId": parent}, () => chrome.runtime.lastError);
    }
  }
  contextPlaces.forEach(function (item) {
    if (!item.placeId) {
      return;
    }
    if (!item.location) {
      return;
    }
    if (item.placeId != settings.placeId) {
      gsMenuIds.push(String(item.placeId));
      chrome.contextMenus.create({"title": item.location, "id": String(item.placeId), "parentId": parent}, () => chrome.runtime.lastError);
    }
  });
} // mNote: onClicked listener moved to top (once per worker)

function deleteUULE() {
  chrome.cookies.getAll({'name':'UULE'}, function(cookies) {
    // v1.21.0: for-in على مصفوفة كان بيدي keys نصية + لوج لكل كوكي — تنضيف صامت
    for (const cookie of (cookies || [])) {
      var url = 'https://'+cookie.domain+cookie.path;
      try { chrome.cookies.remove({'name':'UULE', 'url': url}, function() { void chrome.runtime.lastError; }); } catch (_) {}
    }
  });
}

function genericOnClick(info, tab) {
  if (info.menuItemId == 'disable') {
    settings.enabled = false;
    deleteUULE();
  } else {
    var data = knownPlaces.find(place => place.placeId == info.menuItemId);
    if (data && data.placeId) {
      Object.assign(settings, data);
      settings.enabled = true;
    }
  }
  settings.timestamp = new Date().getTime();
  chrome.storage.local.set({settings: settings});
}
