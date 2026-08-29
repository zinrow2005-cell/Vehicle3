(() => {
  'use strict';

  const SCHEMA_VERSION = 58;
  const APP_VERSION = '5.6.6';
  const STORAGE_KEY = 'vehicleMaintenanceFuelV48';
  const LEGACY_STORAGE_KEYS = ['vehicleMaintenanceFuelV47','vehicleMaintenanceFuelV46','vehicleMaintenanceFuelV45','vehicleMaintenanceFuelV44','vehicleMaintenanceFuelV43','vehicleMaintenanceFuelV42','vehicleMaintenanceFuelV41','vehicleMaintenanceFuelV40','vehicleMaintenanceFuelV39','vehicleMaintenanceFuelV38','vehicleMaintenanceFuelV37','vehicleMaintenanceFuelV36','vehicleMaintenanceFuelV35','vehicleMaintenanceFuelV34','vehicleMaintenanceFuelV33','vehicleMaintenanceFuelV31','vehicleMaintenanceFuelV1','vehicleMaintenanceFuelV3'];
  const APPEARANCE_STORAGE_KEY = 'vehicleMaintenanceAppearanceV1';
  const SNAPSHOT_STORAGE_KEY = 'vehicleMaintenanceSnapshotsV1';
  const MAX_LOCAL_SNAPSHOTS = 8;
  const DEFAULT_APPEARANCE = {theme:'dark',fontSize:'large',highContrast:true};
  const DEFAULT_AUTOMATION_SETTINGS = {enabled:true,autoPartReminders:true,autoObligationReminders:true,browserNotifications:false,autoUpdateCheck:true,intervalHours:6,leadDays:60,leadKm:2000,lastRunAt:'',lastRunReason:'',lastNotificationAt:'',periodicSyncRegistered:false};
  const AUTOMATION_LOG_LIMIT = 80;
  const LICENSE_TAX_BRACKETS = [[500,1620],[600,2160],[1200,4320],[1800,7120],[2400,11230],[3000,15210],[4200,28220],[5400,46170],[6600,69690],[7800,117000],[Infinity,151200]];
  const ROAD_FEE_GAS_BRACKETS = [[500,2160],[600,2880],[1200,4320],[1800,4800],[2400,6180],[3000,7200],[3600,8640],[4200,9810],[4800,11220],[5400,12180],[6000,13080],[6600,13950],[7200,14910],[8000,15720],[Infinity,15720]];
  const ROAD_FEE_DIESEL_BRACKETS = [[500,1296],[600,1728],[1200,2592],[1800,2880],[2400,3708],[3000,4320],[3600,5184],[4200,5886],[4800,6732],[5400,7308],[6000,7848],[6600,8370],[7200,8946],[8000,9432],[Infinity,9432]];
  const COLORS = ['#2f8cff','#3dd6d0','#f2a62b','#8b65ff','#8294a8','#49c96b','#ff6d7b'];
  const noop = () => {};
  let NULL_ELEMENT;
  const nullElements = new Proxy({}, {get:()=>NULL_ELEMENT});
  NULL_ELEMENT = new Proxy({
    value:'', textContent:'', innerHTML:'', hidden:true, dataset:{}, style:{}, elements:nullElements,
    classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},
    addEventListener:noop, removeEventListener:noop, append:noop, reset:noop, focus:noop,
    querySelector:()=>null, querySelectorAll:()=>[], closest:()=>null
  }, {get:(target,key)=>key in target?target[key]:noop,set:(target,key,value)=>{target[key]=value;return true;}});
  const $ = (sel, root=document) => root?.querySelector?.(sel) || NULL_ELEMENT;
  const $$ = (sel, root=document) => [...(root?.querySelectorAll?.(sel) || [])];
  const isReal = el => el !== NULL_ELEMENT;
  const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const money = n => new Intl.NumberFormat('zh-TW',{style:'currency',currency:'TWD',maximumFractionDigits:0}).format(Number(n)||0).replace('NT$','$');
  const money2 = n => `$${num(Number(n)||0,2)}`;
  const num = (n,d=0) => new Intl.NumberFormat('zh-TW',{maximumFractionDigits:d,minimumFractionDigits:d}).format(Number(n)||0);
  const parseDate = s => s ? new Date(`${s}T00:00:00`) : null;
  const esc = s => String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;
  const isLexusVehicleName = name => String(name||'').toUpperCase().includes('LEXUS');
  const maskPlateValue = value => {
    const plate=String(value||'').trim().toUpperCase();
    if(!plate||plate.includes('*'))return plate;
    const parts=plate.split('-');
    if(parts.length===2&&parts[0].length>=2)return `${parts[0].slice(0,2)}${'*'.repeat(Math.max(2,parts[0].length-2))}-${parts[1]}`;
    return plate.length>4?`${plate.slice(0,2)}**${plate.slice(-2)}`:plate;
  };

  const DEFAULT_MAINTENANCE_AGE_PROFILES = [
    {id:'age-0-2',minAge:0,maxAge:2,label:'新車保固期',description:'以原廠週期保養、保固與召回確認為主，非事故狀況下通常較少大型修復。',budgetLow:8000,budgetHigh:18000,reserveFund:10000,checkMonths:12,eventMin:1,eventMax:2,risk:{routine:2,rubber:1,cooling:1,electrical:1,suspension:1,transmission:1,ac:1},focus:['依原廠週期更換機油與濾芯','確認保固、召回與軟體更新','輪胎、煞車與電瓶基礎檢查']},
    {id:'age-3-5',minAge:3,maxAge:5,label:'初期耗材期',description:'輪胎、電瓶、煞車與部分油液逐步進入第一次集中更換期。',budgetLow:12000,budgetHigh:26000,reserveFund:15000,checkMonths:12,eventMin:1,eventMax:3,risk:{routine:3,rubber:2,cooling:2,electrical:2,suspension:1,transmission:2,ac:2},focus:['輪胎與煞車耗材','電瓶與充電系統','煞車油、冷卻液及變速箱油依手冊檢查']},
    {id:'age-6-8',minAge:6,maxAge:8,label:'耗材集中更換期',description:'橡膠件、避震、皮帶、電瓶、冷卻與空調零件的維修機率開始提高。',budgetLow:18000,budgetHigh:36000,reserveFund:25000,checkMonths:9,eventMin:2,eventMax:4,risk:{routine:3,rubber:3,cooling:3,electrical:3,suspension:3,transmission:2,ac:3},focus:['底盤橡膠、避震與防塵套','皮帶、油封與冷卻系統','冷氣效能與電系檢查']},
    {id:'age-9-12',minAge:9,maxAge:12,label:'中車齡老化期',description:'時間老化與里程耗損開始疊加，維修支出容易出現年度波動。',budgetLow:22000,budgetHigh:45000,reserveFund:35000,checkMonths:6,eventMin:2,eventMax:5,risk:{routine:4,rubber:4,cooling:3,electrical:4,suspension:4,transmission:3,ac:4},focus:['冷卻、電系與漏油檢查','底盤、轉向及煞車系統','變速箱與引擎周邊油封／墊片']},
    {id:'age-13-15',minAge:13,maxAge:15,label:'高車齡維護期',description:'多數原始橡膠、油封、感知器與機電零件已進入較高故障機率區間。',budgetLow:26000,budgetHigh:52000,reserveFund:45000,checkMonths:6,eventMin:3,eventMax:6,risk:{routine:4,rubber:5,cooling:4,electrical:4,suspension:4,transmission:4,ac:4},focus:['橡膠管路、油封與墊片','水箱、水幫浦與冷卻風扇','發電機、啟動馬達與感知器']},
    {id:'age-16-20',minAge:16,maxAge:20,label:'老車風險期',description:'維修決策應兼顧安全、可靠度、零件取得與車輛剩餘使用價值。',budgetLow:30000,budgetHigh:60000,reserveFund:60000,checkMonths:4,eventMin:3,eventMax:7,risk:{routine:4,rubber:5,cooling:5,electrical:5,suspension:5,transmission:4,ac:5},focus:['每季檢查漏油、漏水與底盤間隙','預留突發電系、冷卻或空調修復費','高額維修前比較車輛價值與預計持有年限']},
    {id:'age-21-plus',minAge:21,maxAge:null,label:'高齡老車期',description:'時間老化是主要風險來源，即使年里程低，橡膠、油封、電系、冷卻、底盤與空調仍可能陸續修復。',budgetLow:35000,budgetHigh:70000,reserveFund:80000,checkMonths:3,eventMin:4,eventMax:8,risk:{routine:5,rubber:5,cooling:5,electrical:5,suspension:5,transmission:5,ac:5},focus:['建立安全／可靠度優先的分級維修清單','每季檢查油水、煞車、輪胎、底盤與電系','高額維修分成必要、可延後及舒適性項目決策']}
  ];
  const AGE_RISK_LABELS = {routine:'例行保養',rubber:'橡膠／油封',cooling:'冷卻系統',electrical:'電系',suspension:'底盤／懸吊',transmission:'引擎／傳動',ac:'空調／便利'};
  const DEFAULT_PART_STANDARDS = [
    {id:'engine-oil',category:'引擎保養',name:'引擎機油',aliases:['機油更換','0W/40','0W-40','引擎機油'],excludeAliases:['機油芯','油心'],mode:'replace',intervalKm:10000,intervalMonths:12,inspectKm:5000,inspectMonths:6,firstInspectAge:0,safety:'medium',ageSensitive:true,applicability:'所有燃油車',notes:'依原廠規格、使用環境與油品等級調整；高齡車以時間與里程先到者為準。'},
    {id:'oil-filter',category:'引擎保養',name:'機油濾芯',aliases:['機油芯','油心','機油濾芯'],mode:'replace',intervalKm:10000,intervalMonths:12,inspectKm:5000,inspectMonths:6,firstInspectAge:0,safety:'medium',ageSensitive:true,applicability:'所有燃油車',notes:'通常與機油同次更換。'},
    {id:'engine-air-filter',category:'濾芯耗材',name:'引擎空氣濾芯',aliases:['空氣濾芯','空氣芯','引擎濾清器'],mode:'hybrid',intervalKm:20000,intervalMonths:24,inspectKm:10000,inspectMonths:12,firstInspectAge:1,safety:'low',ageSensitive:true,applicability:'所有燃油車',notes:'多灰塵、農場或砂塵環境應縮短檢查週期。'},
    {id:'cabin-filter',category:'濾芯耗材',name:'冷氣／車室濾網',aliases:['冷氣濾清器','AC濾網','車室濾網','冷氣濾網'],mode:'replace',intervalKm:15000,intervalMonths:12,inspectKm:10000,inspectMonths:6,firstInspectAge:1,safety:'low',ageSensitive:true,applicability:'所有車輛',notes:'有異味、風量下降或環境粉塵多時提早更換。'},
    {id:'brake-fluid',category:'煞車安全',name:'煞車油',aliases:['煞車油','剎車油'],mode:'replace',intervalKm:40000,intervalMonths:24,inspectKm:10000,inspectMonths:12,firstInspectAge:2,safety:'high',ageSensitive:false,applicability:'所有車輛',notes:'需配合含水率與沸點檢測；安全項目不得只依外觀判斷。'},
    {id:'brake-pads',category:'煞車安全',name:'煞車來令片',aliases:['煞車來令片','剎車來令片','煞車皮'],mode:'inspect',intervalKm:40000,intervalMonths:36,inspectKm:10000,inspectMonths:12,firstInspectAge:2,safety:'high',ageSensitive:false,applicability:'所有車輛',notes:'屬磨耗件，應以厚度、異音、制動狀況及技師檢查決定，不宜只按里程直接更換。'},
    {id:'brake-discs',category:'煞車安全',name:'煞車碟盤',aliases:['煞車碟盤','剎車碟盤','碟盤'],mode:'inspect',intervalKm:80000,intervalMonths:72,inspectKm:20000,inspectMonths:12,firstInspectAge:4,safety:'high',ageSensitive:false,applicability:'所有車輛',notes:'依厚度、偏擺、裂紋與煞車抖動判斷是否研磨或更換。'},
    {id:'coolant',category:'冷卻系統',name:'引擎冷卻液',aliases:['冷卻液','水箱精','水箱水'],mode:'replace',intervalKm:80000,intervalMonths:48,inspectKm:10000,inspectMonths:12,firstInspectAge:3,safety:'high',ageSensitive:true,applicability:'所有水冷引擎車輛',notes:'不同冷卻液規格週期差異大，原廠手冊優先；需檢查濃度、酸鹼值與污染。'},
    {id:'radiator-hoses',category:'冷卻系統',name:'水管／橡膠冷卻管路',aliases:['水管','冷卻水管','水箱水管'],mode:'inspect',intervalKm:60000,intervalMonths:60,inspectKm:10000,inspectMonths:12,firstInspectAge:5,safety:'high',ageSensitive:true,applicability:'所有水冷引擎車輛',notes:'檢查硬化、龜裂、膨脹、滲漏與接頭狀況，發現劣化才汰換。'},
    {id:'water-pump',category:'冷卻系統',name:'水幫浦',aliases:['水幫浦','水泵浦','水泵'],mode:'inspect',intervalKm:100000,intervalMonths:96,inspectKm:20000,inspectMonths:12,firstInspectAge:6,safety:'high',ageSensitive:true,applicability:'所有水冷引擎車輛',notes:'檢查漏水、異音、軸承間隙與水溫異常；正時皮帶車型常與正時作業一併評估。'},
    {id:'atf',category:'傳動系統',name:'自動變速箱油',aliases:['自動變速箱油','自排油','AISIN WS','ATF'],mode:'hybrid',intervalKm:60000,intervalMonths:48,inspectKm:20000,inspectMonths:12,firstInspectAge:3,safety:'medium',ageSensitive:true,applicability:'自排車',notes:'依變速箱型式、原廠規格、油況與使用條件調整；不可混用規格。'},
    {id:'spark-plugs',category:'引擎點火',name:'火星塞',aliases:['火星塞'],excludeAliases:['火星塞橡皮','火星塞油封'],mode:'replace',intervalKm:100000,intervalMonths:72,inspectKm:30000,inspectMonths:24,firstInspectAge:4,safety:'medium',ageSensitive:true,applicability:'汽油車',notes:'一般、白金、銥合金火星塞週期不同；須依實際規格調整。'},
    {id:'timing-belt',category:'引擎安全',name:'正時皮帶組',aliases:['正時皮帶','時規皮帶'],mode:'replace',intervalKm:100000,intervalMonths:72,inspectKm:20000,inspectMonths:12,firstInspectAge:5,safety:'critical',ageSensitive:false,applicability:'正時皮帶車型；目前預設套用 LEXUS ES300',vehiclePattern:'LEXUS ES300|ES 300',notes:'無更換紀錄時應優先查證；是否連同惰輪、張力器、水幫浦更換由車型與技師檢查決定。'},
    {id:'accessory-belts',category:'引擎周邊',name:'發電機／附件皮帶',aliases:['發電機皮帶','方向機皮帶','附件皮帶','綜合皮帶'],mode:'hybrid',intervalKm:60000,intervalMonths:48,inspectKm:10000,inspectMonths:12,firstInspectAge:4,safety:'medium',ageSensitive:true,applicability:'有附件皮帶車型',notes:'檢查裂紋、硬化、毛邊、異音與張力；有劣化再更換。'},
    {id:'battery',category:'電系',name:'12V電瓶',aliases:['電瓶','蓄電池'],mode:'hybrid',intervalKm:0,intervalMonths:48,inspectKm:0,inspectMonths:12,firstInspectAge:2,safety:'medium',ageSensitive:false,applicability:'所有車輛',notes:'以CCA、內阻、電壓及啟動能力判斷；時間到不代表必須立即更換。'},
    {id:'tires',category:'輪胎安全',name:'輪胎',aliases:['輪胎','換胎'],mode:'inspect',intervalKm:50000,intervalMonths:60,inspectKm:10000,inspectMonths:6,firstInspectAge:1,safety:'critical',ageSensitive:false,applicability:'所有車輛',notes:'以胎紋、龜裂、偏磨、胎壓、補胎位置及製造年份判斷；安全項目需現場檢查。'},
    {id:'shocks',category:'底盤懸吊',name:'避震器',aliases:['避震器'],mode:'inspect',intervalKm:80000,intervalMonths:72,inspectKm:20000,inspectMonths:12,firstInspectAge:5,safety:'high',ageSensitive:true,applicability:'所有車輛',notes:'檢查漏油、彈跳、異音、操控與輪胎偏磨，不宜僅因車齡直接更換。'},
    {id:'bushings',category:'底盤懸吊',name:'底盤橡膠／三角架／拉桿',aliases:['三角架','平均桿橡皮','小拉桿','羊角鐵套','底盤橡膠'],mode:'inspect',intervalKm:60000,intervalMonths:60,inspectKm:20000,inspectMonths:12,firstInspectAge:5,safety:'high',ageSensitive:true,applicability:'所有車輛',notes:'檢查龜裂、鬆動、間隙、異音及定位異常，依實際損壞位置汰換。'},
    {id:'cv-boots',category:'傳動系統',name:'傳動軸防塵套',aliases:['傳動軸內側防塵套','傳動軸防塵套','CV防塵套'],mode:'inspect',intervalKm:40000,intervalMonths:36,inspectKm:10000,inspectMonths:12,firstInspectAge:4,safety:'high',ageSensitive:true,applicability:'前驅／四驅車',notes:'發現破裂、滲油或異音應儘速處理，避免傳動軸接頭擴大損壞。'},
    {id:'engine-mounts',category:'引擎周邊',name:'引擎腳／變速箱腳',aliases:['引擎腳','變速箱腳','引擎腳墊','扭力臂','扭力桿','上引擎支架'],mode:'inspect',intervalKm:80000,intervalMonths:96,inspectKm:20000,inspectMonths:12,firstInspectAge:6,safety:'medium',ageSensitive:true,applicability:'所有燃油車',notes:'以怠速震動、入檔衝擊、橡膠裂化或液壓腳滲漏判斷。'},
    {id:'power-steering-fluid',category:'轉向系統',name:'動力方向機油',aliases:['方向機油'],mode:'hybrid',intervalKm:60000,intervalMonths:48,inspectKm:20000,inspectMonths:12,firstInspectAge:4,safety:'high',ageSensitive:true,applicability:'液壓方向機車型；目前預設套用 LEXUS ES300',vehiclePattern:'LEXUS ES300|ES 300',notes:'檢查油色、油位、滲漏、泵浦異音及轉向手感；電子方向機不適用。'},
    {id:'ac-system',category:'空調便利',name:'冷氣系統效能檢查',aliases:['蒸發器','冷氣管路','冷媒','冷氣閥','冷氣風向馬達'],mode:'inspect',intervalKm:0,intervalMonths:24,inspectKm:0,inspectMonths:12,firstInspectAge:3,safety:'low',ageSensitive:true,applicability:'所有車輛',notes:'冷媒不是固定消耗品；應依冷度、壓力、洩漏與異音檢查，不建議無症狀定期補充。'},
    {id:'wipers',category:'視野安全',name:'雨刷片',aliases:['雨刷片','雨刷'],mode:'hybrid',intervalKm:0,intervalMonths:12,inspectKm:0,inspectMonths:6,firstInspectAge:1,safety:'medium',ageSensitive:false,applicability:'所有車輛',notes:'出現刮不乾淨、跳動、異音或橡膠龜裂時更換。'}
  ];
  const PART_STATUS_META = {
    normal:{label:'正常',className:'green',rank:0},
    inspect:{label:'建議檢查',className:'blue',rank:1},
    soon:{label:'接近汰換',className:'amber',rank:2},
    due:{label:'應優先處理',className:'red',rank:3},
    unknown:{label:'缺少紀錄',className:'gray',rank:1}
  };
  const PART_CONDITION_OPTIONS = [['unknown','未檢查'],['normal','正常'],['attention','注意'],['worn','劣化／磨耗'],['failed','故障／失效']];


  const VOLVO_30K_MAINTENANCE = {
    id:'volvo-maint-20230509-30k',vehicleId:'v1',date:'2023-05-09',invoiceDate:'2023-05-09',odometer:31642,type:'定期保養',vendor:'匯勝汽車有限公司',workOrder:'WA23050113',
    items:'3萬公里定期保養、機油與濾芯更換、燃油濾清器、引擎空氣濾清器、四輪煞車清潔與輪胎平衡',
    parts:11898,labor:5859,discount:0,total:17757,nextKm:null,nextDate:'2024-02-21',warrantyDate:null,
    notes:'資料來源：VOLVO XC60 3萬公里維修清單（2頁）。車型欄記載 XC60 B4 Momentum；當時里程31,642 km；初次領牌日2020/10/28。零件原價小計12,028元、折扣119元、免費零件11元，實收零件11,898元；工資5,859元；總額17,757元。電瓶SOC 82%、健康良好；來令片前10 mm、後8.5 mm；胎紋前4.5 mm、後4.2 mm；胎壓38 psi。單據另記載中央冷氣行駛時有異音，檢查試車後未發現異常，建議持續觀察。個人姓名、電話、地址與車身號碼未寫入系統。',
    attachment:'attachments/VOLVO_XC60_3萬公里維修清單.pdf',
    details:[
      {category:'工資',name:'3萬公里保養：保養提示燈歸零、品檢',qty:1,unitPrice:2079,amount:2079},
      {category:'工資',name:'四輪煞車保養清潔（含卡鉗）',qty:1,unitPrice:1890,amount:1890},
      {category:'工資',name:'更換燃油濾清器',qty:1,unitPrice:756,amount:756},
      {category:'工資',name:'更換引擎空氣濾清器',qty:1,unitPrice:189,amount:189},
      {category:'工資',name:'平衡車輪×4',qty:1,unitPrice:945,amount:945},
      {category:'零件',name:'空氣濾清器 XC90 16-',qty:1,unitPrice:1848,amount:1848},
      {category:'零件',name:'機油濾清器',qty:1,unitPrice:830,amount:830},
      {category:'零件',name:'燃油濾清器－汽油 SPA',qty:1,unitPrice:3014,amount:3014},
      {category:'用品',name:'引擎節能保護劑',qty:1,unitPrice:788,amount:669,note:'單據折扣85折，實收669元'},
      {category:'零件',name:'機油－VOLVO VCC RBS0-2AE 0W-20',qty:6,unitPrice:788,amount:4728},
      {category:'用品',name:'汽油添加劑',qty:1,unitPrice:315,amount:315},
      {category:'用品',name:'煞車盤清潔劑 500ml',qty:1,unitPrice:368,amount:368},
      {category:'零件',name:'放油塞墊片',qty:1,unitPrice:126,amount:126},
      {category:'免費服務',name:'Service 2.0 綠能軟體升級',qty:1,unitPrice:11,amount:0,note:'單據免費金額11元'},
      {category:'免費服務',name:'四輪輪胎對調、胎壓檢查與充氣',qty:1,unitPrice:0,amount:0},
      {category:'檢查',name:'電瓶檢測',qty:1,unitPrice:0,amount:0,note:'SOC 82%，健康狀態良好'},
      {category:'檢查',name:'煞車來令片厚度',qty:1,unitPrice:0,amount:0,note:'前右10 mm、前左10 mm、後右8.5 mm、後左8.5 mm，內外相同'},
      {category:'檢查',name:'輪胎胎紋與胎壓',qty:1,unitPrice:0,amount:0,note:'胎紋前4.5 mm、後4.2 mm；胎壓38 psi；備胎不適用'},
      {category:'免費服務',name:'臭氧殺菌服務',qty:1,unitPrice:0,amount:0},
      {category:'檢查',name:'中央冷氣異音檢查與試車',qty:1,unitPrice:0,amount:0,note:'檢查試車後無異常，建議持續觀察'}
    ]
  };

  const VOLVO_40K_MAINTENANCE = {
    id:'volvo-maint-20240805-40k',vehicleId:'v1',date:'2024-08-05',invoiceDate:'2024-08-05',odometer:41713,type:'定期保養',vendor:'匯勝汽車有限公司',workOrder:'WA24080060',
    items:'4萬公里定期保養、火星塞、車內空氣濾芯、煞車油、機油與濾芯更換',
    parts:15829,labor:4515,discount:1114,total:20344,nextKm:null,nextDate:'2025-08-05',warrantyDate:null,
    notes:'資料來源：VOLVO XC60 4萬公里維修清單（2頁）。當時里程41,713 km。工資原價5,805元、免費工資1,290元、實收4,515元；零件原價17,562元、折讓1,114元、免費零件619元、實收15,829元；總額20,344元。電瓶檢測SOH 55%、SOC 60%，判定不良並建議更換；前後雨刷片硬化且使用有異音；胎紋前2.8 mm、後3.1 mm，四輪胎紋不足建議更換；胎壓38 psi。個人姓名、電話、地址與車身號碼未寫入系統。',
    attachment:'attachments/VOLVO_XC60_4萬公里維修清單.pdf',
    details:[
      {category:'工資',name:'4萬公里保養：保養提示燈歸零、品檢',qty:1,unitPrice:2365,amount:2365},
      {category:'工資',name:'更換火星塞',qty:1,unitPrice:645,amount:645},
      {category:'工資',name:'更換車內空氣濾芯',qty:1,unitPrice:430,amount:430},
      {category:'工資',name:'更換煞車油',qty:1,unitPrice:1075,amount:1075},
      {category:'免費服務',name:'仲夏健檢',qty:1,unitPrice:1290,amount:0,note:'單據免費工資1,290元'},
      {category:'零件',name:'墊片－機油蓋',qty:1,unitPrice:452,amount:452},
      {category:'零件',name:'空調濾清器',qty:1,unitPrice:3896,amount:3312,note:'單據以85%計價，折讓584元'},
      {category:'免費服務',name:'Service 2.0 升級軟體',qty:1,unitPrice:11,amount:0,note:'單據免費零件11元'},
      {category:'零件',name:'機油濾清器',qty:1,unitPrice:840,amount:840},
      {category:'零件',name:'煞車油 DOT4&5.1 0.8L',qty:1,unitPrice:882,amount:882},
      {category:'零件',name:'火星塞組 B5',qty:1,unitPrice:4116,amount:4116},
      {category:'零件',name:'機油－VOLVO VCC RBS0-2AE 0W-20',qty:6,unitPrice:788,amount:4728},
      {category:'用品',name:'煞車碟盤清潔劑 500ml',qty:1,unitPrice:368,amount:368},
      {category:'用品',name:'高效機油提升劑',qty:1,unitPrice:578,amount:578},
      {category:'零件',name:'放油塞墊片',qty:1,unitPrice:126,amount:126},
      {category:'精品',name:'2024 MILU 娃娃',qty:1,unitPrice:630,amount:100,note:'單據實收100元'},
      {category:'免費用品',name:'快速玻璃清潔劑（免費部分）',qty:.65,unitPrice:935,amount:0,note:'單據免費金額608元'},
      {category:'用品',name:'快速玻璃清潔劑',qty:.35,unitPrice:935,amount:327},
      {category:'檢查',name:'電瓶檢測',qty:1,unitPrice:0,amount:0,note:'SOH 55%、SOC 60%，檢測不良，建議更換'},
      {category:'檢查',name:'煞車來令片厚度',qty:1,unitPrice:0,amount:0,note:'前右9.5 mm、前左9.5 mm、後右7.5 mm、後左7.5 mm，內外相同'},
      {category:'檢查',name:'輪胎胎紋與胎壓',qty:1,unitPrice:0,amount:0,note:'胎紋前2.8 mm、後3.1 mm；胎壓38 psi；四輪胎紋不足建議更換'},
      {category:'檢查',name:'前後雨刷片',qty:1,unitPrice:0,amount:0,note:'雨刷片硬化，使用有異音，建議更換'},
      {category:'免費服務',name:'導航圖資升級',qty:1,unitPrice:0,amount:0,note:'版本1470'},
      {category:'免費服務',name:'四輪胎壓檢查與充氣',qty:1,unitPrice:0,amount:0}
    ]
  };

  const VOLVO_50K_MAINTENANCE = {
    id:'volvo-maint-20250819-50k',vehicleId:'v1',date:'2025-08-19',invoiceDate:'2025-08-19',odometer:52310,type:'定期保養',vendor:'匯勝汽車有限公司',workOrder:'WV2508028400',
    items:'5萬公里定期保養、機油與濾芯更換、頭燈／胎壓／動力系統檢查、添加劑與冷卻液更換',
    parts:9791,labor:3115,discount:325,total:12906,nextKm:null,nextDate:null,warrantyDate:null,
    notes:'資料來源：VOLVO XC60 5萬公里結算單（1頁）。結算單號B025080323；當時里程52,310 km；工資3,115元、零件9,791元、總額12,906元。冷卻液更換工資原價1,075元，折後750元。增修建議記載：建議更換蓄電池、建議更換前後雨刷，車主暫不更換。個人姓名、電話、地址與車身號碼未寫入系統。',
    attachment:'attachments/VOLVO_XC60_5萬公里維修清單.pdf',
    details:[
      {category:'工資',name:'5萬公里保養：保養提示燈歸零',qty:.4,unitPrice:2150,amount:860},
      {category:'零件',name:'機油濾清器',qty:1,unitPrice:830,amount:830},
      {category:'零件',name:'機油－VCC RBS0-2AE 0W-20 1L',qty:6,unitPrice:788,amount:4728},
      {category:'零件',name:'放油塞墊片',qty:1,unitPrice:126,amount:126},
      {category:'免費服務',name:'Service 2.0 Upgrade',qty:1,unitPrice:11,amount:0,note:'單據結算價0元'},
      {category:'工資',name:'頭燈檢查、調整；引擎及周邊附件檢查；胎壓檢查',qty:.1,unitPrice:2150,amount:215},
      {category:'工資',name:'動力系統檢查',qty:.3,unitPrice:2150,amount:645},
      {category:'工資',name:'清潔配備碰撞警告攝影機前方擋風玻璃內側',qty:.3,unitPrice:2150,amount:645},
      {category:'用品',name:'汽油添加劑',qty:1,unitPrice:399,amount:399},
      {category:'用品',name:'煞車盤清潔劑 500',qty:1,unitPrice:378,amount:378},
      {category:'用品',name:'高效機油提升劑',qty:1,unitPrice:578,amount:578},
      {category:'工資',name:'排放－填充／更換冷卻液',qty:.5,unitPrice:2150,amount:750,note:'原價1,075元，結算750元'},
      {category:'零件',name:'冷卻液 4L',qty:2,unitPrice:1376,amount:2752},
      {category:'檢查',name:'12V蓄電池',qty:1,unitPrice:0,amount:0,note:'建議更換，車主暫不更換'},
      {category:'檢查',name:'前後雨刷片',qty:1,unitPrice:0,amount:0,note:'建議更換，車主暫不更換'}
    ]
  };

  const VOLVO_60K_MAINTENANCE = {
    "id": "volvo-maint-20260810-60k",
    "vehicleId": "v1",
    "date": "2026-08-10",
    "invoiceDate": "2026-08-10",
    "odometer": 63343,
    "type": "定期保養",
    "vendor": "匯勝汽車有限公司（嘉義服務中心）",
    "workOrder": "WV2608011100",
    "items": "6萬公里定期保養、燃油濾清器、引擎空氣濾芯、煞車油、四輪平衡、變速箱油、右上扭力臂更換",
    "parts": 24638,
    "labor": 8815,
    "discount": 1281,
    "total": 33453,
    "nextKm": null,
    "nextDate": "2027-07-21",
    "warrantyDate": null,
    "notes": "資料來源：2026/08/10 VOLVO XC60 原廠預結算單（3頁）；工單 WV2608011100，當時里程63,343 km。工資8,815元、零件24,638元、實際金額33,453元；免費工時1,290元、免費零件11元，免費總額1,301元。依明細銷售價與結算價推算另有折讓1,281元，總額仍以單據實際金額為準。保養檢查：煞車來令片前8 mm、後6 mm；胎紋前5.2 mm、後4.8 mm；胎壓38 PSI；電瓶SOH 100%、SOC 77%，檢測良好。待修建議：蒸發器滲漏，原廠建議更換，本次未列入更換。單據記載下次定保預計2027/07/21。原廠單據年份欄為2021、初次領牌日2020/10/28。個人姓名、電話、地址、車身號碼等不寫入系統文字欄位，原始照片僅保留於附件。",
    "attachment": "attachments/VOLVO_XC60_6萬公里維修清單_2026-08-10.pdf",
    "details": [
      {
        "category": "工資",
        "name": "6萬公里基礎保養：保養提示燈歸零、品檢",
        "qty": 0.4,
        "unitPrice": 2150,
        "amount": 860
      },
      {
        "category": "工資",
        "name": "更換燃油濾清器",
        "qty": 0.4,
        "unitPrice": 2150,
        "amount": 860
      },
      {
        "category": "工資",
        "name": "更換引擎空氣濾清器",
        "qty": 0.1,
        "unitPrice": 2150,
        "amount": 215
      },
      {
        "category": "免費服務",
        "name": "SERVICE 2.0 UPGRADE",
        "qty": 1,
        "unitPrice": 11,
        "amount": 0,
        "note": "單據免費零件11元"
      },
      {
        "category": "零件",
        "name": "機油濾清器",
        "qty": 1,
        "unitPrice": 819,
        "amount": 696,
        "note": "單據85%計價"
      },
      {
        "category": "零件",
        "name": "燃油濾清器－汽油",
        "qty": 1,
        "unitPrice": 2898,
        "amount": 2898
      },
      {
        "category": "零件",
        "name": "引擎空氣濾芯",
        "qty": 1,
        "unitPrice": 1890,
        "amount": 1890
      },
      {
        "category": "零件",
        "name": "機油－VCC RBS0-2AE 0W-20 1L",
        "qty": 6,
        "unitPrice": 788,
        "amount": 4019,
        "note": "銷售價4,728元；單據85%計價，結算4,019元"
      },
      {
        "category": "零件",
        "name": "放油塞墊片",
        "qty": 1,
        "unitPrice": 126,
        "amount": 107,
        "note": "單據85%計價"
      },
      {
        "category": "工資",
        "name": "6萬公里進階保養：輪胎、引擎底盤周邊檢測",
        "qty": 0.7,
        "unitPrice": 2150,
        "amount": 1505
      },
      {
        "category": "工資",
        "name": "更換煞車油",
        "qty": 0.4,
        "unitPrice": 2150,
        "amount": 860
      },
      {
        "category": "零件",
        "name": "煞車油 DOT4&5.1 0.8L",
        "qty": 1,
        "unitPrice": 935,
        "amount": 935
      },
      {
        "category": "工資",
        "name": "平衡車輪×4",
        "qty": 0.6,
        "unitPrice": 2150,
        "amount": 860,
        "note": "銷售價1,290元；單據66.67%計價，結算860元"
      },
      {
        "category": "工資",
        "name": "自動變速箱換油",
        "qty": 1.5,
        "unitPrice": 2150,
        "amount": 3225
      },
      {
        "category": "零件",
        "name": "變速箱油 AW8G XWD 1L",
        "qty": 7,
        "unitPrice": 1281,
        "amount": 8967
      },
      {
        "category": "零件",
        "name": "O型環（變速箱）",
        "qty": 1,
        "unitPrice": 137,
        "amount": 137
      },
      {
        "category": "零件",
        "name": "變速箱放油螺絲",
        "qty": 1,
        "unitPrice": 200,
        "amount": 200
      },
      {
        "category": "零件",
        "name": "變速箱油洩油管O型圈",
        "qty": 1,
        "unitPrice": 137,
        "amount": 137
      },
      {
        "category": "零件",
        "name": "O型環（變速箱）",
        "qty": 1,
        "unitPrice": 137,
        "amount": 137
      },
      {
        "category": "免費服務",
        "name": "導航圖資升級",
        "qty": 1,
        "unitPrice": 0,
        "amount": 0,
        "note": "版本1550"
      },
      {
        "category": "檢查",
        "name": "煞車來令片厚度",
        "qty": 1,
        "unitPrice": 0,
        "amount": 0,
        "note": "前右8 mm、前左8 mm、後右6 mm、後左6 mm"
      },
      {
        "category": "檢查",
        "name": "輪胎胎紋與胎壓",
        "qty": 1,
        "unitPrice": 0,
        "amount": 0,
        "note": "胎紋左前5.2 mm、右前5.2 mm、左後4.8 mm、右後4.8 mm；胎壓38 PSI"
      },
      {
        "category": "免費服務",
        "name": "四輪輪胎對調、胎壓檢查與充氣",
        "qty": 1,
        "unitPrice": 0,
        "amount": 0
      },
      {
        "category": "檢查",
        "name": "電瓶檢測",
        "qty": 1,
        "unitPrice": 0,
        "amount": 0,
        "note": "SOH 100%、SOC 77%，檢測良好"
      },
      {
        "category": "免費服務",
        "name": "2.0軟體更新",
        "qty": 1,
        "unitPrice": 0,
        "amount": 0,
        "note": "單據勾選執行；預估時間約45分鐘"
      },
      {
        "category": "檢查",
        "name": "冷氣蒸發器",
        "qty": 1,
        "unitPrice": 0,
        "amount": 0,
        "note": "待修建議：蒸發器滲漏，建議更換；本次未更換"
      },
      {
        "category": "免費服務",
        "name": "Battery cover",
        "qty": 1,
        "unitPrice": 0,
        "amount": 0
      },
      {
        "category": "免費服務",
        "name": "夏季空調健檢活動",
        "qty": 0.6,
        "unitPrice": 2150,
        "amount": 0,
        "note": "銷售價1,290元；單據列免費工時"
      },
      {
        "category": "工資",
        "name": "更換上引擎支架扭力桿",
        "qty": 0.2,
        "unitPrice": 2150,
        "amount": 430
      },
      {
        "category": "零件",
        "name": "扭力臂－右上",
        "qty": 1,
        "unitPrice": 4515,
        "amount": 4515
      }
    ]
  };


  const VOLVO_FUEL_HISTORY = [
    {
      "id": "volvo-fuel-20260721",
      "vehicleId": "v1",
      "date": "2026-07-21",
      "odometer": 62872,
      "fuelType": "汽油（油品未註明）",
      "liters": 25.56,
      "unitPrice": 31.2989,
      "amount": 800,
      "fullTank": false,
      "fullTankEstimated": false,
      "station": "",
      "usage": "個人／家庭",
      "notes": "本筆已確認部分加油（未加滿）；25.56 L、800元，等待下一次真正加滿後合併計算完整週期",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 516,
      "distanceEstimated": false,
      "dateYearInferred": true,
      "dataQualityStatus": "confirmed",
      "userConfirmed": true
    },
    {
      "id": "volvo-fuel-20260704",
      "vehicleId": "v1",
      "date": "2026-07-04",
      "odometer": 62356,
      "fuelType": "汽油（油品未註明）",
      "liters": 66.14,
      "unitPrice": 31.902,
      "amount": 2110,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 791,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20260606",
      "vehicleId": "v1",
      "date": "2026-06-06",
      "odometer": 61565,
      "fuelType": "汽油（油品未註明）",
      "liters": 65.39,
      "unitPrice": 33.9043,
      "amount": 2217,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；未提供前次里程差；與2026/04/23油量合併計算2026/04/04至2026/06/06區間油耗",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": null,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20260423",
      "vehicleId": "v1",
      "date": "2026-04-23",
      "odometer": null,
      "fuelType": "汽油（油品未註明）",
      "liters": 43.81,
      "unitPrice": 33.8964,
      "amount": 1485,
      "fullTank": null,
      "fullTankEstimated": false,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；未提供里程；此筆油量併入2026/06/06有效週期計算",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": null,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20260404",
      "vehicleId": "v1",
      "date": "2026-04-04",
      "odometer": 60240,
      "fuelType": "汽油（油品未註明）",
      "liters": 55.48,
      "unitPrice": 33.9041,
      "amount": 1881,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 705,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20260314",
      "vehicleId": "v1",
      "date": "2026-03-14",
      "odometer": 59535,
      "fuelType": "汽油（油品未註明）",
      "liters": 57.07,
      "unitPrice": 30.4013,
      "amount": 1735,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 730,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20260220",
      "vehicleId": "v1",
      "date": "2026-02-20",
      "odometer": 58805,
      "fuelType": "汽油（油品未註明）",
      "liters": 64.74,
      "unitPrice": 28.6994,
      "amount": 1858,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 800,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20260126",
      "vehicleId": "v1",
      "date": "2026-01-26",
      "odometer": 58005,
      "fuelType": "汽油（油品未註明）",
      "liters": 63.89,
      "unitPrice": 28.596,
      "amount": 1827,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 777,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20260102",
      "vehicleId": "v1",
      "date": "2026-01-02",
      "odometer": 57228,
      "fuelType": "汽油（油品未註明）",
      "liters": 60.72,
      "unitPrice": 28.2938,
      "amount": 1718,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 744,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20251212",
      "vehicleId": "v1",
      "date": "2025-12-12",
      "odometer": 56484,
      "fuelType": "汽油（油品未註明）",
      "liters": 60.76,
      "unitPrice": 28.7031,
      "amount": 1744,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 767,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20251121",
      "vehicleId": "v1",
      "date": "2025-11-21",
      "odometer": 55717,
      "fuelType": "汽油（油品未註明）",
      "liters": 64.63,
      "unitPrice": 28.5935,
      "amount": 1848,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 826,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20251105",
      "vehicleId": "v1",
      "date": "2025-11-05",
      "odometer": 54891,
      "fuelType": "汽油（油品未註明）",
      "liters": 65.51,
      "unitPrice": 28.8048,
      "amount": 1887,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 817,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20251007",
      "vehicleId": "v1",
      "date": "2025-10-07",
      "odometer": 54074,
      "fuelType": "汽油（油品未註明）",
      "liters": 66.28,
      "unitPrice": 28.6964,
      "amount": 1902,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 832,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20250914",
      "vehicleId": "v1",
      "date": "2025-09-14",
      "odometer": 53242,
      "fuelType": "汽油（油品未註明）",
      "liters": 66.59,
      "unitPrice": 28.8932,
      "amount": 1924,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 821,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20250822",
      "vehicleId": "v1",
      "date": "2025-08-22",
      "odometer": 52421,
      "fuelType": "汽油（油品未註明）",
      "liters": 67.99,
      "unitPrice": 28.6954,
      "amount": 1951,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 822,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20250801",
      "vehicleId": "v1",
      "date": "2025-08-01",
      "odometer": 51599,
      "fuelType": "汽油（油品未註明）",
      "liters": 65.48,
      "unitPrice": 28.4056,
      "amount": 1860,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 794,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20250709",
      "vehicleId": "v1",
      "date": "2025-07-09",
      "odometer": 50805,
      "fuelType": "汽油（油品未註明）",
      "liters": 64.11,
      "unitPrice": 28.4979,
      "amount": 1827,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 776,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20250614",
      "vehicleId": "v1",
      "date": "2025-06-14",
      "odometer": 50029,
      "fuelType": "汽油（油品未註明）",
      "liters": 62.51,
      "unitPrice": 28.1075,
      "amount": 1757,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 777,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20250524",
      "vehicleId": "v1",
      "date": "2025-05-24",
      "odometer": 49252,
      "fuelType": "汽油（油品未註明）",
      "liters": 59.9,
      "unitPrice": 27.9299,
      "amount": 1673,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 773,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20250427",
      "vehicleId": "v1",
      "date": "2025-04-27",
      "odometer": 48479,
      "fuelType": "汽油（油品未註明）",
      "liters": 65.63,
      "unitPrice": 29.8034,
      "amount": 1956,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 855,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20250404",
      "vehicleId": "v1",
      "date": "2025-04-04",
      "odometer": 47624,
      "fuelType": "汽油（油品未註明）",
      "liters": 63.7,
      "unitPrice": 30.2041,
      "amount": 1924,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 797,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20250310",
      "vehicleId": "v1",
      "date": "2025-03-10",
      "odometer": 46827,
      "fuelType": "汽油（油品未註明）",
      "liters": 63.26,
      "unitPrice": 30.6987,
      "amount": 1942,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 817,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20250210",
      "vehicleId": "v1",
      "date": "2025-02-10",
      "odometer": 46010,
      "fuelType": "汽油（油品未註明）",
      "liters": 63.59,
      "unitPrice": 31.2942,
      "amount": 1990,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 780,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20250112",
      "vehicleId": "v1",
      "date": "2025-01-12",
      "odometer": 45230,
      "fuelType": "汽油（油品未註明）",
      "liters": 65.62,
      "unitPrice": 30.2042,
      "amount": 1982,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 832,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20241218",
      "vehicleId": "v1",
      "date": "2024-12-18",
      "odometer": 44398,
      "fuelType": "汽油（油品未註明）",
      "liters": 64.75,
      "unitPrice": 30.0077,
      "amount": 1943,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 791,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20241121",
      "vehicleId": "v1",
      "date": "2024-11-21",
      "odometer": 43607,
      "fuelType": "汽油（油品未註明）",
      "liters": 65.18,
      "unitPrice": 30.1013,
      "amount": 1962,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 819,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20241017",
      "vehicleId": "v1",
      "date": "2024-10-17",
      "odometer": 42788,
      "fuelType": "汽油（油品未註明）",
      "liters": 60.26,
      "unitPrice": 30.4016,
      "amount": 1832,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 691,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20240818",
      "vehicleId": "v1",
      "date": "2024-08-18",
      "odometer": 42097,
      "fuelType": "汽油（油品未註明）",
      "liters": 64.27,
      "unitPrice": 29.8429,
      "amount": 1918,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 781,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20240706",
      "vehicleId": "v1",
      "date": "2024-07-06",
      "odometer": 41316,
      "fuelType": "汽油（油品未註明）",
      "liters": 62.9,
      "unitPrice": 30.3975,
      "amount": 1912,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 668,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20240506",
      "vehicleId": "v1",
      "date": "2024-05-06",
      "odometer": 40648,
      "fuelType": "汽油（油品未註明）",
      "liters": 67.26,
      "unitPrice": 30.895,
      "amount": 2078,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 815,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20240327",
      "vehicleId": "v1",
      "date": "2024-03-27",
      "odometer": 39833,
      "fuelType": "汽油（油品未註明）",
      "liters": 64.1,
      "unitPrice": 30.9984,
      "amount": 1987,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 786,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20240214",
      "vehicleId": "v1",
      "date": "2024-02-14",
      "odometer": 39047,
      "fuelType": "汽油（油品未註明）",
      "liters": 62.91,
      "unitPrice": 30.5039,
      "amount": 1919,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 759,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20240105",
      "vehicleId": "v1",
      "date": "2024-01-05",
      "odometer": 38288,
      "fuelType": "汽油（油品未註明）",
      "liters": 67.19,
      "unitPrice": 31.0016,
      "amount": 2083,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 919,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20231206",
      "vehicleId": "v1",
      "date": "2023-12-06",
      "odometer": 37369,
      "fuelType": "汽油（油品未註明）",
      "liters": 60.74,
      "unitPrice": 31.001,
      "amount": 1883,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 800,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20231110",
      "vehicleId": "v1",
      "date": "2023-11-10",
      "odometer": 36569,
      "fuelType": "汽油（油品未註明）",
      "liters": 66.63,
      "unitPrice": 31.2022,
      "amount": 2079,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 898,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20231011",
      "vehicleId": "v1",
      "date": "2023-10-11",
      "odometer": 35671,
      "fuelType": "汽油（油品未註明）",
      "liters": 65.57,
      "unitPrice": 32.1946,
      "amount": 2111,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 776,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20230908",
      "vehicleId": "v1",
      "date": "2023-09-08",
      "odometer": 34895,
      "fuelType": "汽油（油品未註明）",
      "liters": 63.72,
      "unitPrice": 32.7056,
      "amount": 2084,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 680,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20230722",
      "vehicleId": "v1",
      "date": "2023-07-22",
      "odometer": 34215,
      "fuelType": "汽油（油品未註明）",
      "liters": 60.99,
      "unitPrice": 31.0051,
      "amount": 1891,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 732,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20230630",
      "vehicleId": "v1",
      "date": "2023-06-30",
      "odometer": 33483,
      "fuelType": "汽油（油品未註明）",
      "liters": 63.98,
      "unitPrice": 30.4001,
      "amount": 1945,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 837,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20230609",
      "vehicleId": "v1",
      "date": "2023-06-09",
      "odometer": 32646,
      "fuelType": "汽油（油品未註明）",
      "liters": 65.18,
      "unitPrice": 29.9939,
      "amount": 1955,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 778,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20230514",
      "vehicleId": "v1",
      "date": "2023-05-14",
      "odometer": 31868,
      "fuelType": "汽油（油品未註明）",
      "liters": 66.15,
      "unitPrice": 30.0983,
      "amount": 1991,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 817,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20230424",
      "vehicleId": "v1",
      "date": "2023-04-24",
      "odometer": 31051,
      "fuelType": "汽油（油品未註明）",
      "liters": 65.94,
      "unitPrice": 31.104,
      "amount": 2051,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 860,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20230329",
      "vehicleId": "v1",
      "date": "2023-03-29",
      "odometer": 30191,
      "fuelType": "汽油（油品未註明）",
      "liters": 64.27,
      "unitPrice": 29.9051,
      "amount": 1922,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 809,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20230305",
      "vehicleId": "v1",
      "date": "2023-03-05",
      "odometer": 29382,
      "fuelType": "汽油（油品未註明）",
      "liters": 66.11,
      "unitPrice": 30.4946,
      "amount": 2016,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 866,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20230215",
      "vehicleId": "v1",
      "date": "2023-02-15",
      "odometer": 28516,
      "fuelType": "汽油（油品未註明）",
      "liters": 64.02,
      "unitPrice": 30.6935,
      "amount": 1965,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 850,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20230125",
      "vehicleId": "v1",
      "date": "2023-01-25",
      "odometer": 27666,
      "fuelType": "汽油（油品未註明）",
      "liters": 59.89,
      "unitPrice": 30.6061,
      "amount": 1833,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 749,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20230106",
      "vehicleId": "v1",
      "date": "2023-01-06",
      "odometer": 26917,
      "fuelType": "汽油（油品未註明）",
      "liters": 63.44,
      "unitPrice": 31.0057,
      "amount": 1967,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 850,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20221211",
      "vehicleId": "v1",
      "date": "2022-12-11",
      "odometer": 26067,
      "fuelType": "汽油（油品未註明）",
      "liters": 66.74,
      "unitPrice": 30.8061,
      "amount": 2056,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 851,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20221106",
      "vehicleId": "v1",
      "date": "2022-11-06",
      "odometer": 25216,
      "fuelType": "汽油（油品未註明）",
      "liters": 49.73,
      "unitPrice": 30.6053,
      "amount": 1522,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 569,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20220930",
      "vehicleId": "v1",
      "date": "2022-09-30",
      "odometer": 24647,
      "fuelType": "汽油（油品未註明）",
      "liters": 65.78,
      "unitPrice": 30.6932,
      "amount": 2019,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 801,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20220821",
      "vehicleId": "v1",
      "date": "2022-08-21",
      "odometer": 23846,
      "fuelType": "汽油（油品未註明）",
      "liters": 63.75,
      "unitPrice": 31.1059,
      "amount": 1983,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 782,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20220625",
      "vehicleId": "v1",
      "date": "2022-06-25",
      "odometer": 23064,
      "fuelType": "汽油（油品未註明）",
      "liters": 63.85,
      "unitPrice": 31.1042,
      "amount": 1986,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 780,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20220407",
      "vehicleId": "v1",
      "date": "2022-04-07",
      "odometer": 22284,
      "fuelType": "汽油（油品未註明）",
      "liters": 64.62,
      "unitPrice": 32.4977,
      "amount": 2100,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 769,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20220117",
      "vehicleId": "v1",
      "date": "2022-01-17",
      "odometer": 21515,
      "fuelType": "汽油（油品未註明）",
      "liters": 68.11,
      "unitPrice": 29.7313,
      "amount": 2025,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 915,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20211225",
      "vehicleId": "v1",
      "date": "2021-12-25",
      "odometer": 20600,
      "fuelType": "汽油（油品未註明）",
      "liters": 64.89,
      "unitPrice": 29.2033,
      "amount": 1895,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 896,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20211208",
      "vehicleId": "v1",
      "date": "2021-12-08",
      "odometer": 19704,
      "fuelType": "汽油（油品未註明）",
      "liters": 67.24,
      "unitPrice": 28.8073,
      "amount": 1937,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 905,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20211117",
      "vehicleId": "v1",
      "date": "2021-11-17",
      "odometer": 18799,
      "fuelType": "汽油（油品未註明）",
      "liters": 66.19,
      "unitPrice": 31.606,
      "amount": 2092,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 904,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20211101",
      "vehicleId": "v1",
      "date": "2021-11-01",
      "odometer": 17895,
      "fuelType": "汽油（油品未註明）",
      "liters": 66.39,
      "unitPrice": 31.7066,
      "amount": 2105,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 939,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20211017",
      "vehicleId": "v1",
      "date": "2021-10-17",
      "odometer": 16956,
      "fuelType": "汽油（油品未註明）",
      "liters": 60.75,
      "unitPrice": 30.2058,
      "amount": 1835,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 826,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20211006",
      "vehicleId": "v1",
      "date": "2021-10-06",
      "odometer": 16130,
      "fuelType": "汽油（油品未註明）",
      "liters": 60.37,
      "unitPrice": 29.7996,
      "amount": 1799,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 827,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20210920",
      "vehicleId": "v1",
      "date": "2021-09-20",
      "odometer": 15303,
      "fuelType": "汽油（油品未註明）",
      "liters": 65.86,
      "unitPrice": 29.6994,
      "amount": 1956,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 872,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20210902",
      "vehicleId": "v1",
      "date": "2021-09-02",
      "odometer": 14431,
      "fuelType": "汽油（油品未註明）",
      "liters": 67.98,
      "unitPrice": 29.494,
      "amount": 2005,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 961,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20210817",
      "vehicleId": "v1",
      "date": "2021-08-17",
      "odometer": 13470,
      "fuelType": "汽油（油品未註明）",
      "liters": 66.95,
      "unitPrice": 29.4996,
      "amount": 1975,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 923,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20210724",
      "vehicleId": "v1",
      "date": "2021-07-24",
      "odometer": 12547,
      "fuelType": "汽油（油品未註明）",
      "liters": 66.31,
      "unitPrice": 30.101,
      "amount": 1996,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 946,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20210703",
      "vehicleId": "v1",
      "date": "2021-07-03",
      "odometer": 11601,
      "fuelType": "汽油（油品未註明）",
      "liters": 60.2,
      "unitPrice": 29.402,
      "amount": 1770,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 799,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20210611",
      "vehicleId": "v1",
      "date": "2021-06-11",
      "odometer": 10802,
      "fuelType": "汽油（油品未註明）",
      "liters": 66.01,
      "unitPrice": 28.6926,
      "amount": 1894,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 903,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20210520",
      "vehicleId": "v1",
      "date": "2021-05-20",
      "odometer": 9899,
      "fuelType": "汽油（油品未註明）",
      "liters": 65.34,
      "unitPrice": 28.2063,
      "amount": 1843,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 851,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20210503",
      "vehicleId": "v1",
      "date": "2021-05-03",
      "odometer": 9048,
      "fuelType": "汽油（油品未註明）",
      "liters": 67.19,
      "unitPrice": 28.2929,
      "amount": 1901,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 929,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20210418",
      "vehicleId": "v1",
      "date": "2021-04-18",
      "odometer": 8119,
      "fuelType": "汽油（油品未註明）",
      "liters": 62.44,
      "unitPrice": 27.9949,
      "amount": 1748,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 874,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20210404",
      "vehicleId": "v1",
      "date": "2021-04-04",
      "odometer": 7245,
      "fuelType": "汽油（油品未註明）",
      "liters": 66.79,
      "unitPrice": 28.2976,
      "amount": 1890,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 902,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20210318",
      "vehicleId": "v1",
      "date": "2021-03-18",
      "odometer": 6343,
      "fuelType": "汽油（油品未註明）",
      "liters": 66.85,
      "unitPrice": 27.4944,
      "amount": 1838,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 933,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20210306",
      "vehicleId": "v1",
      "date": "2021-03-06",
      "odometer": 5410,
      "fuelType": "汽油（油品未註明）",
      "liters": 66.55,
      "unitPrice": 27.1074,
      "amount": 1804,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 940,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20210220",
      "vehicleId": "v1",
      "date": "2021-02-20",
      "odometer": 4470,
      "fuelType": "汽油（油品未註明）",
      "liters": 50.69,
      "unitPrice": 26.4944,
      "amount": 1343,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 640,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20210201",
      "vehicleId": "v1",
      "date": "2021-02-01",
      "odometer": 3830,
      "fuelType": "汽油（油品未註明）",
      "liters": 59.73,
      "unitPrice": 26.5026,
      "amount": 1583,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 796,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20210115",
      "vehicleId": "v1",
      "date": "2021-01-15",
      "odometer": 3034,
      "fuelType": "汽油（油品未註明）",
      "liters": 64.94,
      "unitPrice": 26.1934,
      "amount": 1701,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 818,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20201230",
      "vehicleId": "v1",
      "date": "2020-12-30",
      "odometer": 2216,
      "fuelType": "汽油（油品未註明）",
      "liters": 64.04,
      "unitPrice": 25.4997,
      "amount": 1633,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 796,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20201213",
      "vehicleId": "v1",
      "date": "2020-12-13",
      "odometer": 1420,
      "fuelType": "汽油（油品未註明）",
      "liters": 62.91,
      "unitPrice": 23.9072,
      "amount": 1504,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；區間公里依使用者提供的前後里程差",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": 754,
      "distanceEstimated": false,
      "dateYearInferred": true
    },
    {
      "id": "volvo-fuel-20201122",
      "vehicleId": "v1",
      "date": "2020-11-22",
      "odometer": 666,
      "fuelType": "汽油（油品未註明）",
      "liters": 62.2,
      "unitPrice": 23.4084,
      "amount": 1456,
      "fullTank": true,
      "fullTankEstimated": true,
      "station": "",
      "usage": "個人／家庭",
      "notes": "年份依加油紀錄順序回推；最早一筆基準里程，無前次里程可計算區間油耗",
      "litersEstimated": false,
      "unitPriceEstimated": true,
      "priceSource": "依實付金額÷公升數換算之有效單價（可能含折扣）",
      "odometerEstimated": false,
      "odometerEstimateMethod": "",
      "distanceProvided": null,
      "distanceEstimated": false,
      "dateYearInferred": true
    }
  ];

  const VOLVO_USER_MAINTENANCE = [
    {
      "id": "volvo-maint-20250816-tires",
      "vehicleId": "v1",
      "date": "2025-08-16",
      "invoiceDate": "2025-08-16",
      "odometer": null,
      "type": "輪胎",
      "vendor": "未提供",
      "workOrder": "",
      "items": "更換輪胎",
      "parts": 52200,
      "labor": 0,
      "discount": 0,
      "total": 52200,
      "nextKm": null,
      "nextDate": null,
      "warrantyDate": null,
      "notes": "資料來源：使用者提供之加油／維修時間序列。原始紀錄為「換輪胎 52,200元（8/16）」；年份依前後紀錄回推為2025年。未提供品牌、規格、維修廠、當時里程與是否四輪整組，先依一組輪胎總支出登錄。",
      "attachment": "",
      "dateYearInferred": true,
      "details": [
        {
          "category": "輪胎",
          "name": "更換輪胎（品牌、規格與數量待補）",
          "qty": 1,
          "unitPrice": 52200,
          "amount": 52200
        }
      ]
    },
    {
      "id": "volvo-maint-20250826-battery",
      "vehicleId": "v1",
      "date": "2025-08-26",
      "invoiceDate": "2025-08-26",
      "odometer": null,
      "type": "故障維修",
      "vendor": "未提供",
      "workOrder": "",
      "items": "更換12V蓄電池",
      "parts": 8500,
      "labor": 0,
      "discount": 0,
      "total": 8500,
      "nextKm": null,
      "nextDate": null,
      "warrantyDate": null,
      "notes": "資料來源：使用者提供之加油／維修時間序列。原始紀錄為「換電池 8,500元（8/26）」；年份依前後紀錄回推為2025年。未提供電瓶品牌、規格、維修廠與當時里程。",
      "attachment": "",
      "dateYearInferred": true,
      "details": [
        {
          "category": "電系",
          "name": "更換12V蓄電池（品牌與規格待補）",
          "qty": 1,
          "unitPrice": 8500,
          "amount": 8500
        }
      ]
    }
  ];

  const seed = {
    schemaVersion: SCHEMA_VERSION,
    migrations:{volvoFuelHistoryV52:false,volvoMaintenanceV51:false,volvoUserMaintenanceV52:false,v53QualityCorrections:false,v563Volvo60kMaintenance:false},
    unclassifiedRecords:[{id:'unclassified-volvo-22310',vehicleId:'v1',type:'里程',value:'22310',date:'',status:'待確認',notes:'原始VOLVO加油清單中單獨出現，未附日期、油量與金額，暫不納入里程或油耗計算。'}],
    activeVehicleId: 'v2',
    maintenanceAgeProfiles: structuredClone(DEFAULT_MAINTENANCE_AGE_PROFILES),
    partStandards: structuredClone(DEFAULT_PART_STANDARDS),
    partInspections: [],
    vehicles: [
      {
        id:'v1', name:'VOLVO XC60', plate:'BHO-2086', year:2020, manufactureDate:'', engineCc:null, fuelType:'汽油（油品未註明）', usage:'個人／家庭', odometer:62872, isDemo:false,
        maintenanceMode:'定期保養', serviceKm:10000, serviceMonths:12, insuranceDate:'', inspectionDate:'', fuelTankCapacity:71, reserveLiters:7, benchmarkEfficiency:12.8, efficiencyReference:'依2020/11～2026/07已輸入加油紀錄之長期加權平均約12.8 km/L；油箱容量71L依Volvo官方XC60資料，可自行修改。', maintenanceBudgetLow:null, maintenanceBudgetHigh:null, majorRepairThreshold:null, maintenanceBudgetReference:'', maintenanceCostFactor:1, notes:'車型資料：XC60 B4 Momentum；初次領牌日2020/10/28。已輸入3萬、4萬、5萬公里保養及2020/11～2026/07加油紀錄。加油年份依原始順序回推；原始清單另有一筆未附日期與油量的里程22310，暫不納入計算。'
      },
      {
        id:'v2', name:'LEXUS ES300', plate:'72**-GE', year:2003, manufactureDate:'2003-06', engineCc:3000, fuelType:'95無鉛', usage:'個人／家庭', odometer:321334, isDemo:false,
        maintenanceMode:'不定期保養', serviceKm:null, serviceMonths:null, insuranceDate:'2027-07-05', inspectionDate:'2026-12-09', fuelTankCapacity:70, reserveLiters:7, benchmarkEfficiency:8.9, efficiencyReference:'2003 LEXUS ES300 評估基準：油箱70L；比較油耗8.9km/L（可自行修改）', maintenanceBudgetLow:null, maintenanceBudgetHigh:null, majorRepairThreshold:null, maintenanceBudgetReference:'', maintenanceCostFactor:1, notes:'正式車輛資料；製造年月 2003/06。'
      }
    ],
    fuel: [
      ...structuredClone(VOLVO_FUEL_HISTORY),
      {id:'lex-fuel-20260727',vehicleId:'v2',date:'2026-07-27',odometer:321334,fuelType:'95無鉛',liters:59.37,unitPrice:32,amount:1900,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'本筆已確認加滿',litersEstimated:false,unitPriceEstimated:false,priceSource:''},
      {id:'lex-fuel-20260618',vehicleId:'v2',date:'2026-06-18',odometer:null,fuelType:'95無鉛',liters:59.24,unitPrice:33.9,amount:2008,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'公里數未拍；本筆已確認加滿',litersEstimated:false,unitPriceEstimated:false,priceSource:''},
      {id:'lex-fuel-20260331',vehicleId:'v2',date:'2026-03-31',odometer:null,fuelType:'95無鉛',liters:52.12,unitPrice:33.9,amount:1767,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'公里數未拍；本筆已確認加滿',litersEstimated:false,unitPriceEstimated:false,priceSource:''},
      {id:'lex-fuel-20260308',vehicleId:'v2',date:'2026-03-08',odometer:null,fuelType:'95無鉛',liters:60.2,unitPrice:28.9,amount:1740,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'公里數未拍；本筆已確認加滿',litersEstimated:false,unitPriceEstimated:false,priceSource:''},
      {id:'lex-fuel-20260223',vehicleId:'v2',date:'2026-02-23',odometer:319485,fuelType:'95無鉛',liters:53.93,unitPrice:28.7,amount:1548,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'本筆已確認加滿',litersEstimated:false,unitPriceEstimated:false,priceSource:''},
      {id:'lex-fuel-20260120',vehicleId:'v2',date:'2026-01-20',odometer:319087,fuelType:'95無鉛',liters:58.98,unitPrice:28.7,amount:1622,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'本筆已確認加滿；實付金額已含折價／折扣',litersEstimated:false,unitPriceEstimated:false,priceSource:''},
      {id:'lex-fuel-20251211',vehicleId:'v2',date:'2025-12-11',odometer:318641,fuelType:'95無鉛',liters:58.12,unitPrice:28.7,amount:1668,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'本筆已確認加滿',litersEstimated:false,unitPriceEstimated:false,priceSource:''},
      {id:'lex-fuel-20251126',vehicleId:'v2',date:'2025-11-26',odometer:null,fuelType:'95無鉛',liters:44.64,unitPrice:28.6,amount:1277,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'公里數未拍；本筆已確認加滿',litersEstimated:false,unitPriceEstimated:false,priceSource:''},
      {id:'lex-fuel-20251028',vehicleId:'v2',date:'2025-10-28',odometer:317859,fuelType:'95無鉛',liters:55.98,unitPrice:28.5,amount:1595,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'本筆已確認加滿',litersEstimated:false,unitPriceEstimated:false,priceSource:''},
      {id:'lex-fuel-20251010',vehicleId:'v2',date:'2025-10-10',odometer:317421,fuelType:'95無鉛',liters:59.20,unitPrice:28.7,amount:1699,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'單價採台灣中油當週95無鉛公告牌價；公升數以實付金額÷公告牌價估算；實際可能受折價影響；本筆已確認加滿',litersEstimated:true,unitPriceEstimated:true,priceSource:'台灣中油95無鉛公告牌價（2025-10-06起）'},
      {id:'lex-fuel-20250904',vehicleId:'v2',date:'2025-09-04',odometer:316982,fuelType:'95無鉛',liters:59.89,unitPrice:28.9,amount:1731,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'本筆已確認加滿',litersEstimated:false,unitPriceEstimated:false,priceSource:''},
      {id:'lex-fuel-20250811',vehicleId:'v2',date:'2025-08-11',odometer:316433,fuelType:'95無鉛',liters:60.02,unitPrice:28.7,amount:1643,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'本筆已確認加滿；實付金額已含折價／折扣',litersEstimated:false,unitPriceEstimated:false,priceSource:''},
      {id:'lex-fuel-20250625',vehicleId:'v2',date:'2025-06-25',odometer:315974,fuelType:'95無鉛',liters:58.23,unitPrice:28.2,amount:1642,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'單價採台灣中油當週95無鉛公告牌價；公升數以實付金額÷公告牌價估算；實際可能受折價影響；本筆已確認加滿',litersEstimated:true,unitPriceEstimated:true,priceSource:'台灣中油95無鉛公告牌價（2025-06-23起）'},
      {id:'lex-fuel-20250520',vehicleId:'v2',date:'2025-05-20',odometer:315535,fuelType:'95無鉛',liters:58.67,unitPrice:27.9,amount:1637,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'單價採台灣中油當週95無鉛公告牌價；公升數以實付金額÷公告牌價估算；實際可能受折價影響；本筆已確認加滿',litersEstimated:true,unitPriceEstimated:true,priceSource:'台灣中油95無鉛公告牌價（2025-05-19起）'},
      {id:'lex-fuel-20250415',vehicleId:'v2',date:'2025-04-15',odometer:315035,fuelType:'95無鉛',liters:59.5,unitPrice:29.4,amount:1749,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'本筆已確認加滿',litersEstimated:false,unitPriceEstimated:false,priceSource:''},
      {id:'lex-fuel-20250215',vehicleId:'v2',date:'2025-02-15',odometer:314553,fuelType:'95無鉛',liters:55.39,unitPrice:31.3,amount:1734,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'本筆已確認加滿',litersEstimated:false,unitPriceEstimated:false,priceSource:''},
      {id:'lex-fuel-20241209',vehicleId:'v2',date:'2024-12-09',odometer:314131,fuelType:'95無鉛',liters:59.86,unitPrice:30.1,amount:1802,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'本筆已確認加滿',litersEstimated:false,unitPriceEstimated:false,priceSource:''},
      {id:'lex-fuel-20241103',vehicleId:'v2',date:'2024-11-03',odometer:313683,fuelType:'95無鉛',liters:56.9,unitPrice:30.1,amount:1667,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'本筆已確認加滿；實付金額已含折價／折扣',litersEstimated:false,unitPriceEstimated:false,priceSource:''},
      {id:'lex-fuel-20241002',vehicleId:'v2',date:'2024-10-02',odometer:313133,fuelType:'95無鉛',liters:60.3,unitPrice:30.6,amount:1734,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'本筆已確認加滿；實付金額已含折價／折扣',litersEstimated:false,unitPriceEstimated:false,priceSource:''},
      {id:'lex-fuel-20240711',vehicleId:'v2',date:'2024-07-11',odometer:312622,fuelType:'95無鉛',liters:60.98,unitPrice:30.5,amount:1766,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'本筆已確認加滿；實付金額已含折價／折扣',litersEstimated:false,unitPriceEstimated:false,priceSource:''},
      {id:'lex-fuel-20240417',vehicleId:'v2',date:'2024-04-17',odometer:312173,fuelType:'95無鉛',liters:59.35,unitPrice:31.1,amount:1813,fullTank:true,fullTankEstimated:false,userConfirmed:true,station:'',usage:'家庭',notes:'本筆已確認加滿；實付金額已含折價／折扣',litersEstimated:false,unitPriceEstimated:false,priceSource:''}
    ],
    maintenance: [
      ...structuredClone(VOLVO_USER_MAINTENANCE),
      structuredClone(VOLVO_30K_MAINTENANCE),
      structuredClone(VOLVO_40K_MAINTENANCE),
      structuredClone(VOLVO_50K_MAINTENANCE),
      structuredClone(VOLVO_60K_MAINTENANCE),
      {
        id:'lex-maint-20191030',vehicleId:'v2',date:'2019-10-30',invoiceDate:'2019-10-30',odometer:null,type:'故障維修',vendor:'協德維修廠',workOrder:'',
        items:'底盤、煞車、避震、方向機與冷氣系統整修',parts:48900,labor:4500,discount:0,total:53400,nextKm:null,nextDate:null,warrantyDate:null,
        notes:'資料來源：歷史維修明細；原始明細未記載當時里程。部分零件名稱依原表文字登錄。',attachment:'attachments/LEXUS協德維修明細單預覽.jpg',
        details:[
          {category:'零件',name:'前煞車來令片',qty:1,unitPrice:1800,amount:1800},
          {category:'零件',name:'後煞車來令片',qty:1,unitPrice:1500,amount:1500},
          {category:'零件',name:'平均小拉桿 前',qty:2,unitPrice:1000,amount:2000},
          {category:'零件',name:'平均桿橡皮 前',qty:2,unitPrice:800,amount:1600},
          {category:'零件',name:'平均小拉桿 後',qty:2,unitPrice:1000,amount:2000},
          {category:'零件',name:'平均桿橡皮 後',qty:2,unitPrice:1000,amount:2000},
          {category:'零件',name:'方向機皮帶',qty:1,unitPrice:550,amount:550},
          {category:'零件',name:'發電機皮帶',qty:1,unitPrice:850,amount:850},
          {category:'零件',name:'羊角鐵套 後',qty:2,unitPrice:800,amount:1600},
          {category:'零件',name:'前三角架',qty:2,unitPrice:2850,amount:5700},
          {category:'零件',name:'避震器',qty:4,unitPrice:3500,amount:14000},
          {category:'零件',name:'內把手 左前',qty:1,unitPrice:1800,amount:1800},
          {category:'零件',name:'升降機 左後',qty:1,unitPrice:2500,amount:2500},
          {category:'零件',name:'方向機幫浦',qty:1,unitPrice:3500,amount:3500},
          {category:'零件',name:'方向機油',qty:1,unitPrice:300,amount:300},
          {category:'零件',name:'冷氣濾清器',qty:1,unitPrice:500,amount:500},
          {category:'零件',name:'方向機惰桿',qty:2,unitPrice:1200,amount:2400},
          {category:'服務',name:'定位',qty:1,unitPrice:800,amount:800},
          {category:'零件',name:'冷氣風向馬達',qty:1,unitPrice:3500,amount:3500},
          {category:'工資',name:'拆裝工資',qty:1,unitPrice:4500,amount:4500}
        ]
      },
      {
        id:'lex-maint-20220321',vehicleId:'v2',date:'2022-03-21',invoiceDate:'2022-03-24',odometer:308145,type:'故障維修',vendor:'權威汽車有限公司',workOrder:'A1110321011',
        items:'冷氣蒸發器更換、冷氣管路清洗與冷媒系統維修',parts:8130,labor:7000,discount:0,total:15130,nextKm:null,nextDate:null,warrantyDate:null,
        notes:'印表日期2022/03/24；單據記載下次驗車2022/06/09、下次保險2022/07/19、建議保養里程313,145 km。',attachment:'attachments/1110325斗南權威汽車維修（冷氣）.jpg',
        details:[
          {category:'工資',name:'蒸發器拆裝工資',qty:1,unitPrice:7000,amount:7000},
          {category:'零件',name:'蒸發器（DENSO）',qty:1,unitPrice:4000,amount:4000},
          {category:'零件',name:'冷媒閥（四角）',qty:1,unitPrice:700,amount:700},
          {category:'零件',name:'AC濾網（福士）041／PM2.5',qty:1,unitPrice:530,amount:530},
          {category:'服務',name:'冷氣管路清洗（含冷媒、冷凍油）',qty:1,unitPrice:2800,amount:2800,note:'單據訂價3,500元，實收2,800元'},
          {category:'零件',name:'冷氣閥螺絲',qty:2,unitPrice:50,amount:100}
        ]
      },
      {
        id:'lex-maint-20240119',vehicleId:'v2',date:'2024-01-19',invoiceDate:'2024-01-22',odometer:311690,type:'故障維修',vendor:'權威汽車有限公司',workOrder:'A1130119004',
        items:'定期保養、機油更換、發電機與曲軸皮帶盤維修、電瓶更換',parts:13627,labor:2400,discount:0,total:16027,nextKm:null,nextDate:null,warrantyDate:null,
        notes:'印表日期2024/01/22；單據記載下次驗車2024/06/09、下次保險2024/07/17、建議保養里程316,690 km。電瓶為自備。',attachment:'attachments/相片 2024-1-22 下午2 40 46.jpg',
        details:[
          {category:'工資',name:'保養及檢修工資',qty:1,unitPrice:400,amount:400},
          {category:'工資',name:'發電機、曲軸皮帶盤拆裝工資',qty:1,unitPrice:1800,amount:1800},
          {category:'工資',name:'電瓶（自備）更換',qty:1,unitPrice:200,amount:200},
          {category:'零件',name:'機油（0W/40）SHELL（9折）',qty:4.5,unitPrice:546,amount:2457},
          {category:'零件',name:'油心（3.0）',qty:1,unitPrice:150,amount:150},
          {category:'零件',name:'放油螺絲墊片（鋁）',qty:1,unitPrice:40,amount:40},
          {category:'用品',name:'噴油嘴清洗劑',qty:1,unitPrice:380,amount:380,note:'單據標示原價400元'},
          {category:'零件',name:'曲軸皮帶盤',qty:1,unitPrice:1600,amount:1600},
          {category:'零件',name:'發電機（150A）3支固定腳／土電',qty:1,unitPrice:9000,amount:9000}
        ]
      },
      {
        id:'lex-maint-20251106',vehicleId:'v2',date:'2025-11-06',invoiceDate:'2025-11-08',odometer:318081,type:'定期保養',vendor:'權威汽車有限公司',workOrder:'A1141106007',
        items:'定期保養、機油更換與左後車窗升降機含馬達更換',parts:6717,labor:1100,discount:0,total:7817,nextKm:323081,nextDate:null,warrantyDate:null,
        notes:'印表日期2025/11/08；單據記載下次驗車2025/12/09、下次保險2026/05/05、建議保養里程323,081 km。',attachment:'attachments/2025-11-06權威汽車保養與左後升降機.jpg',
        details:[
          {category:'工資',name:'保養及檢修工資',qty:1,unitPrice:500,amount:500},
          {category:'工資',name:'後升降機（L）含馬達更換工資',qty:1,unitPrice:600,amount:600},
          {category:'零件',name:'機油（0W/40）SHELL（9折）',qty:4.5,unitPrice:546,amount:2457},
          {category:'零件',name:'油心（3.0）',qty:1,unitPrice:160,amount:160},
          {category:'零件',name:'放油螺絲墊片（鋁）',qty:1,unitPrice:40,amount:40},
          {category:'用品',name:'噴油嘴清洗劑',qty:1,unitPrice:380,amount:380,note:'單據標示原價400元'},
          {category:'零件',name:'後升降機（L）含馬達',qty:1,unitPrice:3680,amount:3680}
        ]
      },
      {
        id:'lex-maint-20251113',vehicleId:'v2',date:'2025-11-13',invoiceDate:'2025-11-17',odometer:318081,type:'故障維修',vendor:'權威汽車有限公司',workOrder:'A1141113003',
        items:'搖臂蓋墊片、節氣門與進氣岐管墊片、傳動軸防塵套、火星塞、煞車真空管及自排油維修',parts:10620,labor:3900,discount:0,total:14520,nextKm:null,nextDate:null,warrantyDate:null,
        notes:'印表日期2025/11/17；單據記載下次驗車2025/12/09、下次保險2026/05/05、建議保養里程323,081 km。兩筆節氣門墊片依原單據分別登錄為560元與400元。',attachment:'attachments/2025-11-13權威汽車引擎與傳動維修.jpg',
        details:[
          {category:'工資',name:'搖臂蓋墊片更換工資',qty:1,unitPrice:3000,amount:3000},
          {category:'工資',name:'傳動軸防塵套更換工資',qty:1,unitPrice:600,amount:600},
          {category:'工資',name:'洗油工資',qty:1,unitPrice:300,amount:300},
          {category:'零件',name:'搖臂蓋墊片（L）',qty:1,unitPrice:720,amount:720},
          {category:'零件',name:'搖臂蓋墊片（R）',qty:1,unitPrice:720,amount:720},
          {category:'零件',name:'節氣門墊片（17116-20010）',qty:1,unitPrice:560,amount:560},
          {category:'零件',name:'節氣門墊片（17116-20010）',qty:1,unitPrice:400,amount:400},
          {category:'零件',name:'進氣岐管墊片（中座）',qty:1,unitPrice:720,amount:720},
          {category:'零件',name:'傳動軸防塵套（內）六角',qty:1,unitPrice:300,amount:300},
          {category:'用品',name:'黃油',qty:1,unitPrice:200,amount:200},
          {category:'零件',name:'火星塞',qty:6,unitPrice:400,amount:2400},
          {category:'零件',name:'火星塞橡皮',qty:6,unitPrice:150,amount:900},
          {category:'零件',name:'煞車真空管',qty:1,unitPrice:1600,amount:1600},
          {category:'油品',name:'自動油（WS）6 AISIN／壺',qty:4,unitPrice:450,amount:1800},
          {category:'用品',name:'化清劑（福士）',qty:1,unitPrice:300,amount:300}
        ]
      }
    ],
    reminders: [],
    mileageLogs: [],
    obligations: [
      {id:'lex-insurance-20270705',vehicleId:'v2',type:'保險',provider:'',periodStart:'',periodEnd:'',dueDate:'2027-07-05',amount:0,status:'待繳',paidDate:'',referenceNo:'',notes:'保險種類、保險公司與金額尚未提供',parentId:''},
      {id:'lex-inspection-20261209',vehicleId:'v2',type:'驗車',provider:'監理機關',periodStart:'',periodEnd:'',dueDate:'2026-12-09',amount:0,status:'待繳',paidDate:'',referenceNo:'',notes:'最近驗車日期依提供資料登錄',parentId:''}
    ],
    automationSettings: structuredClone(DEFAULT_AUTOMATION_SETTINGS),
    automationLog: [],
    notificationHistory: {},
    lastBackupAt: '',
    lastSnapshotAt: ''
  };

  let state = load();
  let automationTimer=null;
  let automationRunning=false;
  let deferredInstallPrompt=null;
  let pwaRegistration=null;
  let updateReloading=false;
  const pwaRuntime={serviceWorker:'尚未初始化',offline:'尚未初始化',periodic:'尚未初始化',update:'尚未檢查',install:'尚未偵測',network:navigator.onLine?'線上':'離線'};
  let trendMonths = 12;
  let activeView = 'dashboard';
  let costRecognition = 'accrual';
  let searchTimer = null;
  let appearanceSettings = loadAppearanceSettings();
  const systemThemeMedia = window.matchMedia?.('(prefers-color-scheme: dark)');

  function loadAppearanceSettings(){
    try{
      const parsed=JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY)||'null');
      return {...DEFAULT_APPEARANCE,...(parsed&&typeof parsed==='object'?parsed:{})};
    }catch(e){return {...DEFAULT_APPEARANCE};}
  }
  function resolvedTheme(){
    if(appearanceSettings.theme==='system') return systemThemeMedia?.matches?'dark':'light';
    return appearanceSettings.theme==='light'?'light':'dark';
  }
  function applyAppearanceSettings(saveSetting=false){
    const root=document.documentElement;
    root.dataset.theme=resolvedTheme();
    root.dataset.themePreference=appearanceSettings.theme;
    root.dataset.fontSize=['normal','large','xlarge'].includes(appearanceSettings.fontSize)?appearanceSettings.fontSize:'normal';
    root.dataset.contrast=appearanceSettings.highContrast?'high':'standard';
    if(saveSetting)localStorage.setItem(APPEARANCE_STORAGE_KEY,JSON.stringify(appearanceSettings));
    renderAppearanceControls();
  }
  function renderAppearanceControls(){
    $$('[data-theme-value]').forEach(btn=>btn.classList.toggle('active',btn.dataset.themeValue===appearanceSettings.theme));
    $$('[data-font-size-value]').forEach(btn=>btn.classList.toggle('active',btn.dataset.fontSizeValue===appearanceSettings.fontSize));
    const toggle=$('#highContrastToggle');if(isReal(toggle))toggle.checked=!!appearanceSettings.highContrast;
    const label=appearanceSettings.theme==='system'?'跟隨系統':appearanceSettings.theme==='light'?'亮色':'深色';
    const font=appearanceSettings.fontSize==='xlarge'?'特大':appearanceSettings.fontSize==='large'?'較大':'標準';
    const button=$('#appearanceButton');if(isReal(button))button.textContent=`◐ ${label}・${font}`;
  }
  function updateAppearance(patch){
    appearanceSettings={...appearanceSettings,...patch};
    applyAppearanceSettings(true);
  }
  function toggleAppearancePanel(force){
    const panel=$('#appearancePanel');if(!isReal(panel))return;
    const shouldOpen=typeof force==='boolean'?force:panel.hidden;
    panel.hidden=!shouldOpen;
    const button=$('#appearanceButton');if(isReal(button))button.setAttribute('aria-expanded',String(shouldOpen));
  }

  function addYears(dateString, years=1){
    if(!dateString) return '';
    const d=parseDate(dateString); if(!d) return '';
    d.setFullYear(d.getFullYear()+years);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function addMonths(dateString, months=1){
    if(!dateString) return '';
    const d=parseDate(dateString); if(!d) return '';
    const originalDay=d.getDate();
    d.setDate(1);d.setMonth(d.getMonth()+Number(months||0));
    const lastDay=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
    d.setDate(Math.min(originalDay,lastDay));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function inspectionIntervalMonths(vehicle,date=today()){
    const years=vehicleAgeInfo(vehicle,date).years;
    if(years==null)return 12;
    if(years<5)return null;
    return years>=10?6:12;
  }
  function nullableNumber(value){
    return value===''||value===null||value===undefined?null:Number(value);
  }
  function hasPositiveNumber(value){return value!==null&&value!==''&&Number.isFinite(Number(value))&&Number(value)>0;}
  function fuelOdometerText(value,estimated=false){return hasPositiveNumber(value)?`${num(value)} km${estimated?' <span class="estimated-mark">估算</span>':''}`:'未拍';}
  function fuelLitersText(value,digits=2,estimated=false){return hasPositiveNumber(value)?`${num(value,digits)} L${estimated?' <span class="estimated-mark">估算</span>':''}`:'未輸入';}
  function fuelUnitPriceText(value,digits=2,estimated=false){return hasPositiveNumber(value)?`$${num(value,digits)}${estimated?' <span class="estimated-mark">公告估算</span>':''}`:'未輸入';}
  function fullTankText(value,estimated=false){return value===true?(estimated?'推定加滿':'是'):value===false?'部分加油／未加滿':'未確認';}
  function maintenanceOdometerText(value){return hasPositiveNumber(value)?`${num(value)} km`:'未提供';}
  function fuelEfficiencyDisplay(row){if(row.efficiency){const combined=!row.distanceProvided&&Number(row.cycleLiters)>Number(row.liters||0)+0.01;const label=combined?'合併週期':row.fullTankEstimated?'推定加滿':row.efficiencyEstimated?'估算':'';return `${num(row.efficiency,2)} km/L${label?` <span class="estimated-mark">${label}</span>`:''}`;}return row.fullTank===null?'未確認／併入下次':'累計中';}
  function fullTankBadge(value,estimated=false){return value===true?(estimated?'amber':'green'):value===false?'amber':'blue';}
  function fuelDiscountAmount(row){
    if(!hasPositiveNumber(row?.unitPrice)||!hasPositiveNumber(row?.liters)||!hasPositiveNumber(row?.amount)||row?.litersEstimated)return 0;
    const diff=Number(row.unitPrice)*Number(row.liters)-Number(row.amount);
    return diff>2?diff:0;
  }
  function fuelAmountText(row){
    const discount=fuelDiscountAmount(row);
    return `${money(row.amount)}${discount?`<small class="fuel-discount">折價約 ${money(discount)}</small>`:''}`;
  }

  function completeLexusFuelHistory(data){ return data; }

  function ensureLexusAnnualCharges(data){ return data; }

  function bracketAmount(cc,table){
    const value=Math.max(0,Number(cc)||0);if(!value)return 0;
    return (table.find(([max])=>value<=max)||table.at(-1))?.[1]||0;
  }
  function annualChargeSpecsForVehicle(vehicle){
    const cc=Number(vehicle?.engineCc)||0;const fuel=String(vehicle?.fuelType||'');
    if(!cc||fuel.includes('電動'))return [];
    const license=bracketAmount(cc,LICENSE_TAX_BRACKETS);
    const road=bracketAmount(cc,fuel.includes('柴油')?ROAD_FEE_DIESEL_BRACKETS:ROAD_FEE_GAS_BRACKETS);
    return [
      {key:'license',type:'牌照稅',provider:'地方稅務局',month:'04',day:'30',amount:license,note:`自用小客車 ${num(cc)}cc 使用牌照稅；系統依排氣量級距估算，通常於每年4月繳納。`},
      {key:'road',type:'公路養管費',provider:'交通部公路局／監理機關',month:'07',day:'31',amount:road,note:`自用小客車 ${num(cc)}cc 公路養管費；通常於每年7月繳納。`}
    ].filter(x=>x.amount>0);
  }
  function ensureAnnualVehicleObligations(data=state){
    data.obligations ||= [];
    const currentYear=Number(today().slice(0,4));
    for(const vehicle of data.vehicles||[]){
      const specs=annualChargeSpecsForVehicle(vehicle);if(!specs.length)continue;
      for(const year of [currentYear,currentYear+1,currentYear+2])for(const spec of specs){
        const dueDate=`${year}-${spec.month}-${spec.day}`;
        const autoKey=`vehicle-${vehicle.id}-${spec.key}-${year}`;
        let existing=data.obligations.find(o=>o.vehicleId===vehicle.id&&(o.autoKey===autoKey||(o.type===spec.type&&o.dueDate===dueDate)));
        if(existing){
          if(existing.autoGenerated&&existing.status!=='已繳'){existing.amount=spec.amount;existing.provider=spec.provider;existing.notes=existing.notes||spec.note;existing.autoKey=existing.autoKey||autoKey;}
          continue;
        }
        const past=dueDate<today();
        data.obligations.push({id:uid(),vehicleId:vehicle.id,autoKey,autoGenerated:true,type:spec.type,provider:spec.provider,periodStart:`${year}-01-01`,periodEnd:`${year}-12-31`,dueDate,amount:spec.amount,status:past?'待確認':'待繳',paidDate:'',estimatedPaid:false,referenceNo:'',parentId:'',notes:`${spec.note}${past?' 系統偵測期限已過，請確認是否已繳。':' 系統自動建立年度待繳紀錄。'}`});
      }
    }
  }
  function ensureVehicleMasterDueItems(data=state){
    data.obligations ||= [];
    for(const vehicle of data.vehicles||[]){
      const items=[
        {type:'驗車',date:vehicle.inspectionDate,provider:'監理機關／代檢廠',notes:'由車輛主檔的驗車日期自動建立。'},
        {type:'保險',date:vehicle.insuranceDate,provider:'保險公司待確認',notes:'由車輛主檔的保險到期日自動建立。'}
      ];
      for(const item of items){
        if(!item.date)continue;
        const existing=data.obligations.find(o=>o.vehicleId===vehicle.id&&o.dueDate===item.date&&(o.type===item.type||(item.type==='保險'&&['保險','強制險','任意險'].includes(o.type))));
        if(existing)continue;
        data.obligations.push({id:uid(),vehicleId:vehicle.id,type:item.type,provider:item.provider,periodStart:'',periodEnd:'',dueDate:item.date,amount:item.type==='驗車'?450:0,status:item.date<today()?'待確認':'待繳',paidDate:'',estimatedPaid:false,referenceNo:'',parentId:'',autoGenerated:true,autoKey:`master-${vehicle.id}-${item.type}-${item.date}`,notes:item.notes});
      }
    }
  }

  function ensureChartTooltip(svg){
    const host=svg.parentElement;
    if(!host)return NULL_ELEMENT;
    host.classList.add('interactive-chart-host');
    let tip=host.querySelector('.chart-tooltip');
    if(!tip){tip=document.createElement('div');tip.className='chart-tooltip';tip.hidden=true;host.appendChild(tip);}
    return tip;
  }
  function bindChartTooltip(svg,data,formatter){
    const tip=ensureChartTooltip(svg);
    svg.onpointermove=e=>{
      const zone=e.target.closest?.('[data-chart-index]');
      if(!zone){tip.hidden=true;return;}
      const item=data[Number(zone.dataset.chartIndex)];
      if(!item){tip.hidden=true;return;}
      tip.innerHTML=formatter(item);
      tip.hidden=false;
      const hostRect=svg.parentElement.getBoundingClientRect();
      const tipRect=tip.getBoundingClientRect();
      let left=e.clientX-hostRect.left+14;
      let top=e.clientY-hostRect.top+14;
      if(left+tipRect.width>hostRect.width-8)left=e.clientX-hostRect.left-tipRect.width-14;
      if(top+tipRect.height>hostRect.height-8)top=e.clientY-hostRect.top-tipRect.height-14;
      tip.style.left=`${Math.max(8,left)}px`;
      tip.style.top=`${Math.max(8,top)}px`;
    };
    svg.onpointerleave=()=>{tip.hidden=true;};
  }



  function ensureVolvoMaintenanceHistory(data){
    const volvo=(data.vehicles||[]).find(v=>v.id==='v1'||String(v.name||'').toUpperCase().includes('VOLVO'));
    if(!volvo)return;
    [VOLVO_30K_MAINTENANCE,VOLVO_40K_MAINTENANCE,VOLVO_50K_MAINTENANCE,VOLVO_60K_MAINTENANCE].forEach(record=>{
      const exists=(data.maintenance||[]).some(m=>m.id===record.id||m.workOrder===record.workOrder);
      if(!exists)data.maintenance.push({...structuredClone(record),vehicleId:volvo.id});
    });
    if(!volvo.plate)volvo.plate='BHO-2086';
    if(!volvo.year)volvo.year=2020;
    volvo.odometer=Math.max(Number(volvo.odometer)||0,63343);
    if(!volvo.maintenanceMode)volvo.maintenanceMode='定期保養';
    if(!hasPositiveNumber(volvo.serviceKm))volvo.serviceKm=10000;
    if(!hasPositiveNumber(volvo.serviceMonths))volvo.serviceMonths=12;
    const note='車型資料：XC60 B4 Momentum；維修單記載初次領牌日2020/10/28。已輸入3萬、4萬、5萬及6萬公里原廠維修紀錄。';
    if(!String(volvo.notes||'').includes('已輸入3萬、4萬、5萬及6萬公里'))volvo.notes=[volvo.notes,note].filter(Boolean).join(' ');
  }

  function ensureVolvoDocumentedInspections(data){
    const volvo=(data.vehicles||[]).find(v=>v.id==='v1'||String(v.name||'').toUpperCase().includes('VOLVO'));
    if(!volvo)return;
    const records=[
      {standardId:'battery',lastInspectDate:'2025-08-19',condition:'worn',notes:'2024/08/05電瓶檢測SOH 55%、SOC 60%，判定不良並建議更換；2025/08/19再次建議更換蓄電池，車主暫不更換。'},
      {standardId:'wipers',lastInspectDate:'2025-08-19',condition:'worn',notes:'2024/08/05前後雨刷片硬化且使用有異音；2025/08/19再次建議更換前後雨刷，車主暫不更換。'},
      {standardId:'tires',lastInspectDate:'2024-08-05',condition:'worn',notes:'2024/08/05胎紋前2.8 mm、後3.1 mm，四輪胎紋不足並建議更換；目前沒有後續換胎紀錄。'}
    ];
    records.forEach(row=>{
      const existing=(data.partInspections||[]).find(x=>x.vehicleId===volvo.id&&x.standardId===row.standardId);
      if(!existing){data.partInspections.push({id:`volvo-${row.standardId}-documented`,vehicleId:volvo.id,standardId:row.standardId,lastReplaceDate:'',lastReplaceOdometer:null,...row});return;}
      if(!existing.lastInspectDate||existing.lastInspectDate<=row.lastInspectDate){
        existing.lastInspectDate=row.lastInspectDate;
        if(!existing.condition||['unknown','normal'].includes(existing.condition))existing.condition=row.condition;
        if(!String(existing.notes||'').includes(row.notes.slice(0,10)))existing.notes=[existing.notes,row.notes].filter(Boolean).join(' ');
      }
    });
  }


  function ensureVolvo60KMaintenance(data){
    const volvo=(data.vehicles||[]).find(v=>v.id==='v1'||String(v.name||'').toUpperCase().includes('VOLVO'));
    if(!volvo)return;
    data.maintenance ||= []; data.partInspections ||= []; data.reminders ||= []; data.partStandards ||= [];
    const exists=data.maintenance.some(m=>m.id===VOLVO_60K_MAINTENANCE.id||m.workOrder===VOLVO_60K_MAINTENANCE.workOrder);
    if(!exists)data.maintenance.push({...structuredClone(VOLVO_60K_MAINTENANCE),vehicleId:volvo.id});
    volvo.odometer=Math.max(Number(volvo.odometer)||0,63343);
    const vehicleNote='2026/08/10於VOLVO原廠完成6萬公里保養、變速箱油／煞車油／濾芯更換及右上扭力臂更換；63,343 km，實付33,453元。';
    if(!String(volvo.notes||'').includes('2026/08/10於VOLVO原廠完成6萬公里保養'))volvo.notes=[volvo.notes,vehicleNote].filter(Boolean).join(' ');
    const mountStd=data.partStandards.find(x=>x.id==='engine-mounts');
    if(mountStd){mountStd.aliases=Array.isArray(mountStd.aliases)?mountStd.aliases:[];['扭力臂','扭力桿','上引擎支架'].forEach(a=>{if(!mountStd.aliases.includes(a))mountStd.aliases.push(a);});}
    const severity={unknown:0,normal:1,attention:2,worn:3,failed:4};
    const updateInspection=(standardId,condition,notes)=>{
      let item=data.partInspections.find(x=>x.vehicleId===volvo.id&&x.standardId===standardId);
      if(!item){item={id:`volvo-${standardId}-20260810`,vehicleId:volvo.id,standardId,lastReplaceDate:'',lastReplaceOdometer:null,lastInspectDate:'',condition:'unknown',notes:''};data.partInspections.push(item);}
      if(!item.lastInspectDate||item.lastInspectDate<'2026-08-10')item.lastInspectDate='2026-08-10';
      if((condition==='normal'&&['unknown','normal'].includes(item.condition))||(condition!=='normal'&&(severity[condition]||0)>=(severity[item.condition]||0)))item.condition=condition;
      if(!String(item.notes||'').includes(notes))item.notes=[item.notes,notes].filter(Boolean).join(' ');
    };
    updateInspection('battery','normal','2026/08/10原廠檢測：SOH 100%、SOC 77%，檢測良好。');
    updateInspection('tires','normal','2026/08/10原廠檢查：胎紋前5.2 mm、後4.8 mm；胎壓38 PSI。');
    updateInspection('brake-pads','normal','2026/08/10原廠檢查：來令片前8 mm、後6 mm。');
    updateInspection('ac-system','attention','2026/08/10原廠待修建議：蒸發器滲漏，建議更換；本次未更換。');
    let reminder=data.reminders.find(r=>r.sourceType==='maintenance'&&r.sourceId===VOLVO_60K_MAINTENANCE.id);
    if(!reminder){reminder={id:'volvo-reminder-20270721-service',vehicleId:volvo.id};data.reminders.push(reminder);}
    Object.assign(reminder,{vehicleId:volvo.id,title:'VOLVO XC60 定期保養',category:'定期保養',targetKm:null,targetDate:'2027-07-21',status:'active',notes:'依2026/08/10原廠預結算單記載：下次定保預計2027/07/21。',sourceType:'maintenance',sourceId:VOLVO_60K_MAINTENANCE.id});
  }


  function ensureVolvoFuelHistory(data){
    const volvo=(data.vehicles||[]).find(v=>v.id==='v1'||String(v.name||'').toUpperCase().includes('VOLVO'));
    if(!volvo)return;
    data.fuel ||= [];
    VOLVO_FUEL_HISTORY.forEach(record=>{
      const exists=data.fuel.some(x=>x.id===record.id||(x.vehicleId===volvo.id&&x.date===record.date&&Number(x.odometer||0)===Number(record.odometer||0)&&Math.abs(Number(x.liters||0)-Number(record.liters||0))<0.01));
      if(!exists)data.fuel.push({...structuredClone(record),vehicleId:volvo.id});
    });
    volvo.odometer=Math.max(Number(volvo.odometer)||0,62872);
    volvo.plate=volvo.plate||'BHO-2086';
    volvo.year=volvo.year||2020;
    volvo.fuelType=volvo.fuelType||'汽油（油品未註明）';
    volvo.usage=volvo.usage||'個人／家庭';
    volvo.maintenanceMode=volvo.maintenanceMode||'定期保養';
    volvo.serviceKm=hasPositiveNumber(volvo.serviceKm)?volvo.serviceKm:10000;
    volvo.serviceMonths=hasPositiveNumber(volvo.serviceMonths)?volvo.serviceMonths:12;
    volvo.fuelTankCapacity=hasPositiveNumber(volvo.fuelTankCapacity)?volvo.fuelTankCapacity:71;
    if(volvo.reserveLiters===null||volvo.reserveLiters===undefined)volvo.reserveLiters=7;
    if(!hasPositiveNumber(volvo.benchmarkEfficiency))volvo.benchmarkEfficiency=12.8;
    if(!volvo.efficiencyReference)volvo.efficiencyReference='依2020/11～2026/07已輸入加油紀錄之長期加權平均約12.8 km/L；油箱容量71L依Volvo官方XC60資料，可自行修改。';
    const note='已輸入2020/11～2026/07共78筆加油紀錄；未註明年份依紀錄順序回推。2026/04/23未拍里程，油量併入2026/06/06有效週期。原始清單另有未附日期與油量的里程22310，暫不納入計算。';
    if(!String(volvo.notes||'').includes('共78筆加油紀錄'))volvo.notes=[volvo.notes,note].filter(Boolean).join(' ');
  }

  function ensureVolvoUserMaintenance(data){
    const volvo=(data.vehicles||[]).find(v=>v.id==='v1'||String(v.name||'').toUpperCase().includes('VOLVO'));
    if(!volvo)return;
    data.maintenance ||= [];
    VOLVO_USER_MAINTENANCE.forEach(record=>{
      const exists=data.maintenance.some(x=>x.id===record.id||(x.vehicleId===volvo.id&&x.date===record.date&&Number(x.total||0)===Number(record.total||0)&&String(x.items||'').includes(record.items)));
      if(!exists)data.maintenance.push({...structuredClone(record),vehicleId:volvo.id});
    });
    data.partInspections ||= [];
    const updates=[
      {standardId:'tires',lastReplaceDate:'2025-08-16',condition:'normal',notes:'使用者提供：2025/08/16更換輪胎，支出52,200元；品牌、規格、數量與當時里程待補。'},
      {standardId:'battery',lastReplaceDate:'2025-08-26',condition:'normal',notes:'使用者提供：2025/08/26更換12V蓄電池，支出8,500元；品牌、規格與當時里程待補。'}
    ];
    updates.forEach(row=>{
      let item=data.partInspections.find(x=>x.vehicleId===volvo.id&&x.standardId===row.standardId);
      if(!item){item={id:`volvo-${row.standardId}-replacement-2025`,vehicleId:volvo.id,standardId:row.standardId,lastReplaceDate:'',lastReplaceOdometer:null,lastInspectDate:'',condition:'unknown',notes:''};data.partInspections.push(item);}
      if(!item.lastReplaceDate||item.lastReplaceDate<row.lastReplaceDate)item.lastReplaceDate=row.lastReplaceDate;
      item.condition=row.condition;
      if(!String(item.notes||'').includes(row.notes.slice(0,15)))item.notes=[item.notes,row.notes].filter(Boolean).join(' ');
    });
  }

  function applyLexusActualData(data){ return data; }

  function applyLexusMaintenanceHistory(data){ return data; }

  function prependFuelConfirmationNote(row, text){
    const original=String(row.notes||'')
      .replace(/本筆已確認加滿[；。]?/g,'')
      .replace(/本筆已確認部分加油[；。]?/g,'')
      .replace(/是否加滿未確認[；。]?/g,'')
      .replace(/本筆依516 km／25\.56L計算約20\.19 km\/L，明顯高於長期表現；暫列待確認是否加滿，不納入有效油耗平均。[；。]?/g,'')
      .replace(/^[；。\s]+|[；。\s]+$/g,'');
    row.notes=original?`${text}；${original}`:text;
  }

  function applyV56ConfirmedFuelCycles(data){
    const vehicles=data.vehicles||[];
    const volvo=vehicles.find(v=>v.id==='v1'||String(v.name||'').toUpperCase().includes('VOLVO'));
    const lexus=vehicles.find(v=>v.id==='v2'||isLexusVehicleName(v.name));
    (data.fuel||[]).forEach(row=>{
      const knownVolvo=volvo&&row.vehicleId===volvo.id&&String(row.id||'').startsWith('volvo-fuel-');
      const knownLexus=lexus&&row.vehicleId===lexus.id&&String(row.id||'').startsWith('lex-fuel-');
      if(knownVolvo){
        const partial=row.date==='2026-07-21'||row.id==='volvo-fuel-20260721';
        row.fullTank=!partial;
        row.fullTankEstimated=false;
        row.userConfirmed=true;
        if(partial){
          row.dataQualityStatus='confirmed';
          prependFuelConfirmationNote(row,'本筆已確認部分加油（未加滿）');
          row.dataQualityNotes='人工確認：2026/07/21僅加25.56 L、800元，未加滿；等待下一次真正加滿後合併計算完整週期。';
        }else{
          prependFuelConfirmationNote(row,'本筆已確認加滿');
        }
      }
      if(knownLexus){
        row.fullTank=true;
        row.fullTankEstimated=false;
        row.userConfirmed=true;
        prependFuelConfirmationNote(row,'本筆已確認加滿');
      }
    });
    if(volvo){
      volvo.notes=String(volvo.notes||'')
        .replace(/加油每一筆皆視為加滿[^。]*。?/g,'')
        .replace(/每一筆都加滿[^。]*。?/g,'');
      const note='加油紀錄以人工確認為準：除2026/07/21為25.56 L、800元部分加油外，其餘既有VOLVO加油紀錄均已確認加滿。';
      if(!volvo.notes.includes('2026/07/21為25.56 L'))volvo.notes=[volvo.notes,note].filter(Boolean).join(' ');
    }
    if(lexus){
      const note='既有21筆LEXUS加油紀錄均已人工確認加滿；未拍里程的加滿紀錄會累積至下一筆有里程的加滿紀錄後再結算完整週期。';
      if(!String(lexus.notes||'').includes('既有21筆LEXUS加油紀錄'))lexus.notes=[lexus.notes,note].filter(Boolean).join(' ');
    }
  }

  function applyV58PartBaselineCorrections(data){
    (data.partInspections||[]).forEach(item=>{
      if(item.lastReplaceDate&&(!item.lastInspectDate||item.lastReplaceDate>item.lastInspectDate)){
        item.lastInspectDate=item.lastReplaceDate;
        if(item.condition==='worn'||item.condition==='failed'||item.condition==='attention')item.condition='normal';
        const note='最近實際更換日期已作為新的檢查週期基準。';
        if(!String(item.notes||'').includes(note))item.notes=[item.notes,note].filter(Boolean).join(' ');
      }
    });
  }

  function readLocalSnapshots(){
    try{const rows=JSON.parse(localStorage.getItem(SNAPSHOT_STORAGE_KEY)||'[]');return Array.isArray(rows)?rows:[];}catch{return [];}
  }
  function writeLocalSnapshots(rows){
    try{localStorage.setItem(SNAPSHOT_STORAGE_KEY,JSON.stringify((rows||[]).slice(0,MAX_LOCAL_SNAPSHOTS)));}catch(err){console.warn('本機快照保存失敗',err);}
  }
  function createLocalSnapshot(reason='手動快照',payload=null){
    try{
      const source=payload&&typeof payload==='object'?structuredClone(payload):structuredClone(state);
      const snapshot={id:uid(),createdAt:new Date().toISOString(),reason,schemaVersion:Number(source.schemaVersion)||0,data:source};
      const rows=[snapshot,...readLocalSnapshots()].slice(0,MAX_LOCAL_SNAPSHOTS);
      writeLocalSnapshots(rows);
      return snapshot;
    }catch(err){console.warn('無法建立快照',err);return null;}
  }
  function latestLocalSnapshot(){return readLocalSnapshots()[0]||null;}

  function applyV53FuelCorrections(data){
    data.unclassifiedRecords=Array.isArray(data.unclassifiedRecords)?data.unclassifiedRecords:[];
    if(!data.unclassifiedRecords.some(x=>x.id==='unclassified-volvo-22310'))data.unclassifiedRecords.push({id:'unclassified-volvo-22310',vehicleId:'v1',type:'里程',value:'22310',date:'',status:'待確認',notes:'原始VOLVO加油清單中單獨出現，未附日期、油量與金額，暫不納入里程或油耗計算。'});
    const apr=(data.fuel||[]).find(x=>x.id==='volvo-fuel-20260423'||(x.vehicleId==='v1'&&x.date==='2026-04-23'));
    if(apr){
      apr.odometer=60772;apr.odometerEstimated=true;apr.odometerEstimateMethod='依2026/04/04 60,240 km與2026/06/06 61,565 km，按43.81L與65.39L油量比例分配1,325 km，估算本次行駛約532 km。';
      apr.distanceProvided=532;apr.distanceEstimated=true;apr.fullTank=true;apr.fullTankEstimated=true;apr.dataQualityStatus='estimated';apr.userConfirmed=false;
      apr.notes='里程60,772 km為估算值；依前後里程及兩次加油量比例推估。本筆先以推定加滿計算，可日後人工確認。';
    }
    const jun=(data.fuel||[]).find(x=>x.id==='volvo-fuel-20260606'||(x.vehicleId==='v1'&&x.date==='2026-06-06'));
    if(jun){jun.notes='年份依加油紀錄順序回推；2026/04/23里程已拆分估算，本筆依獨立加滿週期計算。';jun.dataQualityStatus=jun.dataQualityStatus||'inferred';}
    const jul=(data.fuel||[]).find(x=>x.id==='volvo-fuel-20260721'||(x.vehicleId==='v1'&&x.date==='2026-07-21'));
    if(jul){jul.fullTank=null;jul.fullTankEstimated=false;jul.dataQualityStatus='review';jul.userConfirmed=false;jul.notes='本筆依516 km／25.56L計算約20.19 km/L，明顯高於長期表現；暫列待確認是否加滿，不納入有效油耗平均。';}
    (data.fuel||[]).forEach(f=>{
      if(!f.dataQualityStatus){
        if(f.odometerEstimated||f.litersEstimated||f.unitPriceEstimated)f.dataQualityStatus='estimated';
        else if(f.dateYearInferred||f.fullTankEstimated)f.dataQualityStatus='inferred';
        else f.dataQualityStatus='confirmed';
      }
      f.userConfirmed=!!f.userConfirmed;
      f.dataQualityNotes=f.dataQualityNotes||'';
    });
    const volvo=(data.vehicles||[]).find(v=>v.id==='v1'||String(v.name||'').toUpperCase().includes('VOLVO'));
    if(volvo){
      volvo.notes=String(volvo.notes||'').replace('2026/04/23未拍里程，油量併入2026/06/06有效週期。','2026/04/23里程以60,772 km估算並保留估算標籤。');
    }
    data.partInspections ||= [];
    const estimatedParts=[
      {standardId:'tires',date:'2025-08-16',odometer:52186,method:'依2025/08/01 51,599 km與2025/08/22 52,421 km按日期比例估算。'},
      {standardId:'battery',date:'2025-08-26',odometer:52564,method:'依2025/08/22 52,421 km與2025/09/14 53,242 km按日期比例估算。'}
    ];
    if(volvo)estimatedParts.forEach(row=>{let item=data.partInspections.find(x=>x.vehicleId===volvo.id&&x.standardId===row.standardId);if(item&&!item.lastReplaceOdometer){item.lastReplaceOdometer=row.odometer;item.lastReplaceOdometerEstimated=true;item.lastReplaceOdometerEstimateMethod=row.method;item.notes=[item.notes,`更換里程約 ${row.odometer.toLocaleString('zh-TW')} km（估算）：${row.method}`].filter(Boolean).join(' ');}});
  }

  function migrateData(input,{clearVehicleRecords=false}={}){
    const data = input && typeof input==='object' ? structuredClone(input) : structuredClone(seed);
    const sourceVersion=Number(data.schemaVersion)||0;
    data.schemaVersion = SCHEMA_VERSION;
    data.migrations = data.migrations&&typeof data.migrations==='object'?data.migrations:{};
    data.unclassifiedRecords = Array.isArray(data.unclassifiedRecords)?data.unclassifiedRecords:[];
    data.vehicles = Array.isArray(data.vehicles) && data.vehicles.length ? data.vehicles : structuredClone(seed.vehicles);
    data.fuel = Array.isArray(data.fuel) ? data.fuel : [];
    data.maintenance = Array.isArray(data.maintenance) ? data.maintenance : [];
    data.reminders = Array.isArray(data.reminders) ? data.reminders : [];
    data.obligations = Array.isArray(data.obligations) ? data.obligations : [];
    data.mileageLogs = Array.isArray(data.mileageLogs) ? data.mileageLogs : [];
    data.maintenanceAgeProfiles = Array.isArray(data.maintenanceAgeProfiles) && data.maintenanceAgeProfiles.length ? data.maintenanceAgeProfiles : structuredClone(DEFAULT_MAINTENANCE_AGE_PROFILES);
    data.partStandards = Array.isArray(data.partStandards) && data.partStandards.length ? data.partStandards : structuredClone(DEFAULT_PART_STANDARDS);
    data.partInspections = Array.isArray(data.partInspections) ? data.partInspections : [];
    data.automationSettings = {...DEFAULT_AUTOMATION_SETTINGS,...(data.automationSettings&&typeof data.automationSettings==='object'?data.automationSettings:{})};
    data.automationSettings.intervalHours=[1,6,12,24].includes(Number(data.automationSettings.intervalHours))?Number(data.automationSettings.intervalHours):6;
    data.automationSettings.leadDays=[30,60,90].includes(Number(data.automationSettings.leadDays))?Number(data.automationSettings.leadDays):60;
    data.automationSettings.leadKm=[1000,2000,3000].includes(Number(data.automationSettings.leadKm))?Number(data.automationSettings.leadKm):2000;
    data.automationLog = Array.isArray(data.automationLog) ? data.automationLog.slice(0,AUTOMATION_LOG_LIMIT) : [];
    data.notificationHistory = data.notificationHistory&&typeof data.notificationHistory==='object'?data.notificationHistory:{};
    data.lastBackupAt = data.lastBackupAt||'';
    data.lastSnapshotAt = data.lastSnapshotAt||'';
    data.fuelAnalysisMode = data.fuelAnalysisMode==='confirmed'?'confirmed':'all';
    if(clearVehicleRecords){
      const volvo=data.vehicles.find(v=>String(v.name||'').toUpperCase().includes('VOLVO')||v.id==='v1');
      const lexus=data.vehicles.find(v=>String(v.name||'').toUpperCase().includes('LEXUS')||v.id==='v2');
      data.vehicles=[
        {...structuredClone(seed.vehicles[0]),id:volvo?.id||'v1',name:'VOLVO XC60'},
        {...structuredClone(seed.vehicles[1]),id:lexus?.id||'v2',name:'LEXUS ES300'}
      ];
      data.activeVehicleId=data.vehicles[0].id;
      data.fuel=[];
      data.maintenance=[];
      data.reminders=[];
      data.obligations=[];
      data.mileageLogs=[];
      data.partInspections=[];
      data.unclassifiedRecords=[];
      data.migrations={volvoFuelHistoryV52:true,volvoMaintenanceV51:true,volvoUserMaintenanceV52:true,v53QualityCorrections:true,v563Volvo60kMaintenance:true};
    }
    data.vehicles.forEach(v=>{
      Object.assign(v,{id:v.id||uid(),name:v.name||'未命名車輛',plate:v.plate||'',year:v.year||null,manufactureDate:v.manufactureDate||'',engineCc:nullableNumber(v.engineCc),fuelType:v.fuelType||'',usage:v.usage||'',odometer:Number(v.odometer)||0,maintenanceMode:v.maintenanceMode||'',serviceKm:nullableNumber(v.serviceKm),serviceMonths:nullableNumber(v.serviceMonths),insuranceDate:v.insuranceDate||'',inspectionDate:v.inspectionDate||'',fuelTankCapacity:nullableNumber(v.fuelTankCapacity),reserveLiters:nullableNumber(v.reserveLiters),benchmarkEfficiency:nullableNumber(v.benchmarkEfficiency),efficiencyReference:v.efficiencyReference||'',maintenanceBudgetLow:nullableNumber(v.maintenanceBudgetLow),maintenanceBudgetHigh:nullableNumber(v.maintenanceBudgetHigh),majorRepairThreshold:nullableNumber(v.majorRepairThreshold),maintenanceBudgetReference:v.maintenanceBudgetReference||'',maintenanceCostFactor:Number(v.maintenanceCostFactor)||1,notes:v.notes||'',isDemo:!!v.isDemo});
      const oldName=String(v.name||'').trim().toLowerCase();
      const isKnownVolvoDemo=v.id==='v1'&&v.plate==='ABC-1234';
      const isKnownLexusDemo=v.id==='v2'&&v.plate==='BDE-5678';
      if(isKnownVolvoDemo){v.name='VOLVO XC60';v.isDemo=true;}
      if(isKnownLexusDemo){
        v.name='LEXUS ES300';v.isDemo=true;
        if(v.usage==='公司公務')v.usage='個人／家庭';
        if(!v.notes||v.notes.includes('短程公務'))v.notes='以通勤、家庭接送與一般市區／高速道路使用為主。';
      }else if(oldName==='volvo xc60') v.name='VOLVO XC60';
      if(sourceVersion<43&&(v.id==='v2'||String(v.name||'').toUpperCase().includes('LEXUS ES300'))&&Number(v.maintenanceBudgetLow)===30000&&Number(v.maintenanceBudgetHigh)===60000&&Number(v.majorRepairThreshold)===30000&&String(v.maintenanceBudgetReference||'').includes('21年以上進口老車')){
        v.maintenanceBudgetLow=null;v.maintenanceBudgetHigh=null;v.majorRepairThreshold=null;v.maintenanceBudgetReference='';
      }
      if((v.id==='v2'||String(v.name||'').toUpperCase().includes('LEXUS ES300'))){
        if(v.plate)v.plate=maskPlateValue(v.plate);
        if(!hasPositiveNumber(v.fuelTankCapacity))v.fuelTankCapacity=70;
        if(v.reserveLiters===null||v.reserveLiters===undefined)v.reserveLiters=7;
        if(!hasPositiveNumber(v.benchmarkEfficiency))v.benchmarkEfficiency=8.9;
        if(!v.efficiencyReference)v.efficiencyReference='2003 LEXUS ES300 評估基準：油箱70L；比較油耗8.9km/L（可自行修改）';
      }
    });
    data.maintenanceAgeProfiles=data.maintenanceAgeProfiles.map((p,i)=>({
      id:p.id||`age-profile-${i+1}`,minAge:Math.max(0,Number(p.minAge)||0),maxAge:p.maxAge===null||p.maxAge===''?null:Math.max(0,Number(p.maxAge)),label:p.label||`車齡階段 ${i+1}`,description:p.description||'',budgetLow:Math.max(0,Number(p.budgetLow)||0),budgetHigh:Math.max(0,Number(p.budgetHigh)||0),reserveFund:Math.max(0,Number(p.reserveFund)||0),checkMonths:Math.max(1,Number(p.checkMonths)||12),eventMin:Math.max(0,Number(p.eventMin)||0),eventMax:Math.max(0,Number(p.eventMax)||0),risk:{...{routine:1,rubber:1,cooling:1,electrical:1,suspension:1,transmission:1,ac:1},...(p.risk||{})},focus:Array.isArray(p.focus)?p.focus:String(p.focus||'').split(/[,，、\n]/).map(x=>x.trim()).filter(Boolean)
    })).sort((a,b)=>a.minAge-b.minAge);
    data.partStandards=data.partStandards.map((p,i)=>({
      id:p.id||`part-standard-${i+1}`,category:p.category||'其他',name:p.name||`零件 ${i+1}`,aliases:Array.isArray(p.aliases)?p.aliases:String(p.aliases||'').split(/[,，、\n]/).map(x=>x.trim()).filter(Boolean),excludeAliases:Array.isArray(p.excludeAliases)?p.excludeAliases:String(p.excludeAliases||'').split(/[,，、\n]/).map(x=>x.trim()).filter(Boolean),mode:['replace','inspect','hybrid'].includes(p.mode)?p.mode:'hybrid',intervalKm:Math.max(0,Number(p.intervalKm)||0),intervalMonths:Math.max(0,Number(p.intervalMonths)||0),inspectKm:Math.max(0,Number(p.inspectKm)||0),inspectMonths:Math.max(0,Number(p.inspectMonths)||0),firstInspectAge:Math.max(0,Number(p.firstInspectAge)||0),safety:['low','medium','high','critical'].includes(p.safety)?p.safety:'medium',ageSensitive:p.ageSensitive!==false,applicability:p.applicability||'所有車輛',vehiclePattern:p.vehiclePattern||'',notes:p.notes||''
    }));
    data.partInspections=data.partInspections.map(x=>({id:x.id||uid(),vehicleId:x.vehicleId,standardId:x.standardId,lastReplaceDate:x.lastReplaceDate||'',lastReplaceOdometer:nullableNumber(x.lastReplaceOdometer),lastReplaceOdometerEstimated:!!x.lastReplaceOdometerEstimated,lastReplaceOdometerEstimateMethod:x.lastReplaceOdometerEstimateMethod||'',lastInspectDate:x.lastInspectDate||'',condition:['unknown','normal','attention','worn','failed'].includes(x.condition)?x.condition:'unknown',notes:x.notes||''}));
    applyV58PartBaselineCorrections(data);
    if(!data.migrations.volvoMaintenanceV51){ensureVolvoDocumentedInspections(data);ensureVolvoMaintenanceHistory(data);data.migrations.volvoMaintenanceV51=true;}
    if(!data.migrations.volvoFuelHistoryV52){ensureVolvoFuelHistory(data);data.migrations.volvoFuelHistoryV52=true;}
    if(!data.migrations.volvoUserMaintenanceV52){ensureVolvoUserMaintenance(data);data.migrations.volvoUserMaintenanceV52=true;}
    if(!data.migrations.v53QualityCorrections){applyV53FuelCorrections(data);data.migrations.v53QualityCorrections=true;}
    if(!data.migrations.v563Volvo60kMaintenance){ensureVolvo60KMaintenance(data);data.migrations.v563Volvo60kMaintenance=true;}
    // V5.6.2：已確認的正式加油事實屬資料不變條件，每次載入都重新校正。
    // 不能只相信舊裝置的 migration 旗標，否則曾經留下 fullTank=null 的 iPhone/iPad 仍可能顯示資料不足。
    applyV56ConfirmedFuelCycles(data);
    data.migrations.v56ConfirmedFuelCycles=true;
    data.migrations.v57CloudRevisionGuard=true;
    data.migrations.v58FinalValidation=true;
    if(sourceVersion<37)applyLexusActualData(data);
    if(sourceVersion<39)applyLexusMaintenanceHistory(data);
    const validIds=new Set(data.vehicles.map(v=>v.id));
    const firstId=data.vehicles[0].id;
    data.activeVehicleId=validIds.has(data.activeVehicleId)?data.activeVehicleId:firstId;
    data.partInspections=data.partInspections.filter(x=>x&&validIds.has(x.vehicleId)&&data.partStandards.some(p=>p.id===x.standardId));
    data.unclassifiedRecords=data.unclassifiedRecords.filter(x=>x&&(!x.vehicleId||validIds.has(x.vehicleId))).map(x=>({id:x.id||uid(),vehicleId:x.vehicleId||'',type:x.type||'其他',value:x.value||'',date:x.date||'',status:x.status||'待確認',notes:x.notes||''}));
    for(const collection of ['fuel','maintenance','reminders','obligations','mileageLogs']){
      data[collection]=data[collection].filter(x=>x&&validIds.has(x.vehicleId)).map(x=>({...x,id:x.id||uid()}));
    }
    const volvoDemo=data.vehicles.find(v=>v.id==='v1'&&v.plate==='ABC-1234');
    if(volvoDemo&&sourceVersion<34){
      const fixes={f8:62542,f9:63052,f10:63590};
      data.fuel.forEach(x=>{if(x.vehicleId==='v1'&&fixes[x.id]&&[61432,61942,62480,62542,63052,63590].includes(Number(x.odometer)))x.odometer=fixes[x.id];});
      const maintenanceFixes={m1:60250,m2:61760,m3:62542};
      data.maintenance.forEach(x=>{if(x.vehicleId==='v1'&&maintenanceFixes[x.id]&&[55400,57800,60000,60250,61760,62542].includes(Number(x.odometer)))x.odometer=maintenanceFixes[x.id];});
      const demoMax=Math.max(0,...data.fuel.filter(x=>x.vehicleId==='v1').map(x=>Number(x.odometer)||0),...data.maintenance.filter(x=>x.vehicleId==='v1').map(x=>Number(x.odometer)||0));
      volvoDemo.odometer=Math.max(Number(volvoDemo.odometer)||0,demoMax,63590);
    }
    data.fuel.forEach(f=>{
      f.odometer=nullableNumber(f.odometer);f.liters=nullableNumber(f.liters);f.unitPrice=nullableNumber(f.unitPrice);f.amount=Number(f.amount)||0;
      f.fullTank=f.fullTank===true?true:f.fullTank===false?false:null;
      f.odometerEstimated=!!f.odometerEstimated;f.odometerEstimateMethod=f.odometerEstimateMethod||'';f.fullTankEstimated=!!f.fullTankEstimated;
      f.litersEstimated=!!f.litersEstimated;f.unitPriceEstimated=!!f.unitPriceEstimated;f.priceSource=f.priceSource||'';f.notes=f.notes||'';
      f.distanceProvided=nullableNumber(f.distanceProvided);f.distanceEstimated=!!f.distanceEstimated;f.dateYearInferred=!!f.dateYearInferred;f.dataQualityStatus=['confirmed','estimated','inferred','review'].includes(f.dataQualityStatus)?f.dataQualityStatus:'confirmed';f.userConfirmed=!!f.userConfirmed;f.dataQualityNotes=f.dataQualityNotes||'';
    });
    completeLexusFuelHistory(data);
    ensureLexusAnnualCharges(data);
    ensureAnnualVehicleObligations(data);
    ensureVehicleMasterDueItems(data);
    data.maintenance.forEach(m=>{Object.assign(m,{date:m.date||today(),invoiceDate:m.invoiceDate||'',odometer:nullableNumber(m.odometer),type:m.type||'其他',vendor:m.vendor||'',workOrder:m.workOrder||'',items:m.items||'',parts:Number(m.parts)||0,labor:Number(m.labor)||0,discount:Number(m.discount)||0,total:Number(m.total)||0,nextKm:nullableNumber(m.nextKm),nextDate:m.nextDate||null,warrantyDate:m.warrantyDate||null,notes:m.notes||'',attachment:m.attachment||'',details:Array.isArray(m.details)?m.details:[]});const vehicle=data.vehicles.find(v=>v.id===m.vehicleId);if(vehicle&&isLexusVehicleName(vehicle.name)){if(m.vendor==='權晟汽車有限公司')m.vendor='權威汽車有限公司';if(String(m.attachment||'').includes('權晟汽車'))m.attachment=String(m.attachment).replaceAll('權晟汽車','權威汽車');}});
    data.reminders.forEach(r=>{r.status=r.status||'active';r.sourceType=r.sourceType||'';r.sourceId=r.sourceId||'';});
    data.obligations.forEach(o=>Object.assign(o,{type:o.type||'其他',provider:o.provider||'',periodStart:o.periodStart||'',periodEnd:o.periodEnd||'',dueDate:o.dueDate||'',amount:Number(o.amount)||0,status:o.status||'待繳',paidDate:o.paidDate||'',referenceNo:o.referenceNo||'',notes:o.notes||'',parentId:o.parentId||'',estimatedPaid:!!o.estimatedPaid,autoGenerated:!!o.autoGenerated,autoKey:o.autoKey||''}));
    data.mileageLogs.forEach(m=>Object.assign(m,{date:m.date||today(),odometer:Number(m.odometer)||0,source:m.source||'手動',notes:m.notes||''}));
    syncAllObligationReminders(data);
    return data;
  }
  function load(){
    try{
      let raw=localStorage.getItem(STORAGE_KEY);
      if(!raw){
        for(const key of LEGACY_STORAGE_KEYS){raw=localStorage.getItem(key);if(raw)break;}
      }
      if(!raw) return migrateData(seed);
      const parsed=JSON.parse(raw);
      if((Number(parsed.schemaVersion)||0)<SCHEMA_VERSION)createLocalSnapshot(`升級前自動快照 V${Number(parsed.schemaVersion)||'舊版'} → V${SCHEMA_VERSION}`,parsed);
      return migrateData(parsed);
    }catch(e){ console.warn('資料讀取失敗，改用內建資料。',e); return migrateData(seed); }
  }
  function save(){
    state.schemaVersion=SCHEMA_VERSION;
    syncAllObligationReminders(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    $('#lastUpdated').textContent = `資料更新：${new Date().toLocaleString('zh-TW',{hour12:false})}`;
  }
  function vehicleById(id){ return state.vehicles.find(v=>v.id===id) || state.vehicles[0]; }
  function activeVehicle(){ return vehicleById(state.activeVehicleId); }
  function vfById(id){ return state.fuel.filter(x=>x.vehicleId===id).sort((a,b)=>a.date.localeCompare(b.date)||a.odometer-b.odometer); }
  function vmById(id){ return state.maintenance.filter(x=>x.vehicleId===id).sort((a,b)=>b.date.localeCompare(a.date)||(Number(b.odometer)||0)-(Number(a.odometer)||0)); }
  function vrById(id){ return state.reminders.filter(x=>x.vehicleId===id && x.status!=='done'); }
  function voById(id){ return (state.obligations||[]).filter(x=>x.vehicleId===id).sort((a,b)=>(a.dueDate||'9999-12-31').localeCompare(b.dueDate||'9999-12-31')); }
  function vf(){ return vfById(state.activeVehicleId); }
  function vm(){ return vmById(state.activeVehicleId); }
  function vr(){ return vrById(state.activeVehicleId); }
  function vo(){ return voById(state.activeVehicleId); }
  function daysUntil(date){ if(!date) return null; return Math.ceil((parseDate(date)-new Date())/86400000); }
  function monthKey(date){ return date.slice(0,7); }

  function syncVehicleDueDates(vehicleId, data=state){
    const vehicle=data.vehicles.find(v=>v.id===vehicleId); if(!vehicle)return;
    const pending=(data.obligations||[]).filter(o=>o.vehicleId===vehicleId&&o.status==='待繳'&&o.dueDate);
    const insurance=pending.filter(o=>['保險','強制險','任意險'].includes(o.type)).sort((a,b)=>a.dueDate.localeCompare(b.dueDate))[0];
    const inspection=pending.filter(o=>o.type==='驗車').sort((a,b)=>a.dueDate.localeCompare(b.dueDate))[0];
    vehicle.insuranceDate=insurance?.dueDate||'';
    vehicle.inspectionDate=inspection?.dueDate||'';
  }
  function syncObligationReminder(item, data=state){
    if(!item)return;
    const category=(['保險','強制險','任意險'].includes(item.type))?'保險':item.type==='驗車'?'驗車':['牌照稅','燃料使用費','公路養管費'].includes(item.type)?'稅費':'';
    const linked=(data.reminders||[]).find(r=>r.sourceType==='obligation'&&r.sourceId===item.id);
    if(!category){if(linked)linked.status='done';return;}
    if(['待繳','待確認'].includes(item.status)&&item.dueDate){
      let reminder=linked || (data.reminders||[]).find(r=>r.vehicleId===item.vehicleId&&r.category===category&&!r.sourceId&&r.targetDate===item.dueDate);
      if(!reminder){reminder={id:uid(),vehicleId:item.vehicleId};data.reminders.push(reminder);}
      Object.assign(reminder,{title:item.status==='待確認'?`${item.type}繳納狀態待確認`:`${item.type}到期`,category,targetKm:null,targetDate:item.dueDate,status:'active',notes:`${item.provider||'承辦單位待確認'}${item.notes?`｜${item.notes}`:''}`,sourceType:'obligation',sourceId:item.id});
    }else if(linked){linked.status='done';}
  }
  function syncAllObligationReminders(data=state){
    data.reminders ||= []; data.obligations ||= [];
    data.obligations.forEach(o=>syncObligationReminder(o,data));
    data.vehicles.forEach(v=>syncVehicleDueDates(v.id,data));
  }
  function mileagePointsForVehicle(vehicleId){
    const points=[];
    for(const x of vfById(vehicleId)){if(hasPositiveNumber(x.odometer))points.push({id:`fuel:${x.id}`,date:x.date,odometer:Number(x.odometer),source:x.odometerEstimated?'加油紀錄（估算）':'加油紀錄',notes:[x.station||x.fuelType,x.odometerEstimated?(x.odometerEstimateMethod||'估算里程'):''].filter(Boolean).join('｜'),manual:false,estimated:!!x.odometerEstimated});}
    for(const x of vmById(vehicleId)){if(hasPositiveNumber(x.odometer))points.push({id:`maint:${x.id}`,date:x.date,odometer:Number(x.odometer),source:'維修保養',notes:x.items||x.vendor,manual:false});}
    for(const x of (state.mileageLogs||[]).filter(m=>m.vehicleId===vehicleId)) points.push({id:x.id,date:x.date,odometer:Number(x.odometer)||0,source:x.source||'手動',notes:x.notes||'',manual:true});
    const vehicle=vehicleById(vehicleId);
    if(vehicle?.odometer) points.push({id:`current:${vehicleId}`,date:today(),odometer:Number(vehicle.odometer)||0,source:'目前車輛里程',notes:'車輛主檔最新值',manual:false});
    const seen=new Set();
    return points.filter(p=>p.date&&p.odometer>=0).sort((a,b)=>a.date.localeCompare(b.date)||a.odometer-b.odometer).filter(p=>{const k=`${p.date}|${p.odometer}|${p.source}`;if(seen.has(k))return false;seen.add(k);return true;});
  }
  function odometerEntriesForValidation(vehicleId, exclude={}){
    const entries=[];
    state.fuel.filter(x=>x.vehicleId===vehicleId).forEach(x=>entries.push({kind:'fuel',id:x.id,date:x.date,odometer:Number(x.odometer)||0,label:'加油紀錄'}));
    state.maintenance.filter(x=>x.vehicleId===vehicleId&&hasPositiveNumber(x.odometer)).forEach(x=>entries.push({kind:'maintenance',id:x.id,date:x.date,odometer:Number(x.odometer),label:'維修保養'}));
    (state.mileageLogs||[]).filter(x=>x.vehicleId===vehicleId).forEach(x=>entries.push({kind:'mileage',id:x.id,date:x.date,odometer:Number(x.odometer)||0,label:x.source||'手動里程'}));
    const vehicle=vehicleById(vehicleId);if(vehicle?.odometer)entries.push({kind:'vehicle',id:vehicleId,date:today(),odometer:Number(vehicle.odometer)||0,label:'目前車輛里程'});
    return entries.filter(x=>x.date&&!(x.kind===exclude.kind&&x.id===exclude.id));
  }
  function validateOdometerEntry({vehicleId,date,odometer,kind,id,allowFutureConfirm=true}){
    const value=Number(odometer);if(!date||!Number.isFinite(value)||value<0)return {ok:false,message:'日期與里程格式不正確。'};
    const entries=odometerEntriesForValidation(vehicleId,{kind,id});
    const previous=entries.filter(x=>x.date<date).sort((a,b)=>b.date.localeCompare(a.date)||b.odometer-a.odometer)[0];
    const next=entries.filter(x=>x.date>date).sort((a,b)=>a.date.localeCompare(b.date)||a.odometer-b.odometer)[0];
    if(previous&&value<previous.odometer)return {ok:false,message:`本筆里程 ${num(value)} km 低於前一筆 ${previous.date} 的 ${num(previous.odometer)} km（${previous.label}）。`};
    if(next&&value>next.odometer)return {ok:false,message:`本筆里程 ${num(value)} km 高於後一筆 ${next.date} 的 ${num(next.odometer)} km（${next.label}）。`};
    if(date>today())return {ok:true,warning:`日期 ${date} 晚於今天，確定要儲存未來日期的里程紀錄嗎？`,allowFutureConfirm};
    return {ok:true};
  }
  function ensureOdometerEntryValid(args){
    const result=validateOdometerEntry(args);
    if(!result.ok){toast(result.message,'error');return false;}
    if(result.warning&&!confirm(result.warning))return false;
    return true;
  }

  function calculateYearDistance(vehicleId, year=today().slice(0,4)){
    const points=mileagePointsForVehicle(vehicleId).filter(p=>p.date.startsWith(year));
    let anomalies=0,maxSeen=-Infinity;
    points.forEach(p=>{if(p.odometer<maxSeen)anomalies++;maxSeen=Math.max(maxSeen,p.odometer);});
    if(points.length<2) return {distance:null,points,anomalies,quality:'資料不足',message:`${year} 年僅有 ${points.length} 筆有效里程，無法計算年度里程。`};
    const first=points[0],last=points.at(-1); const distance=last.odometer-first.odometer;
    if(distance<=0) return {distance:null,points,anomalies:anomalies+1,quality:'資料異常',message:`年度首末里程無法形成正向里程差，請檢查輸入。`};
    const quality=points.length>=4&&anomalies===0?'完整':anomalies?'可計算但有異常':'可計算';
    return {distance,points,anomalies,quality,message:`${year} 年採 ${first.date} 的 ${num(first.odometer)} km 至 ${last.date} 的 ${num(last.odometer)} km，共 ${num(distance)} km${anomalies?`；偵測到 ${anomalies} 筆里程倒退資料`:''}。`};
  }

  function computeFuelRows(rows=vf()){
    let lastFullIndex = null;
    let accumulatedLiters = 0;
    let accumulatedAmount = 0;
    return rows.map((row,i)=>{
      // 只有在已建立「有里程的加滿基準」後，後續每次加油才計入下一個完整週期。
      // 加滿但未拍里程時，不切斷週期：油量與金額持續累積，直到下一筆有里程且加滿再結算。
      if(lastFullIndex !== null){
        if(hasPositiveNumber(row.liters))accumulatedLiters += Number(row.liters);
        accumulatedAmount += Number(row.amount)||0;
      }
      let efficiency = null, costPerKm = null, distance = null, cycleLiters = null, cycleAmount = null, efficiencyEstimated = false;
      const closesCycle=row.fullTank===true&&hasPositiveNumber(row.odometer);
      if(closesCycle){
        if(lastFullIndex !== null){
          const prev = rows[lastFullIndex];
          distance = Number(row.odometer)-Number(prev.odometer);
          if(distance>0 && accumulatedLiters>0){
            cycleLiters=accumulatedLiters;
            cycleAmount=accumulatedAmount;
            efficiency = distance / cycleLiters;
            costPerKm = cycleAmount / distance;
            efficiencyEstimated=!!(row.fullTankEstimated||prev.fullTankEstimated||row.odometerEstimated||prev.odometerEstimated);
          }
        }
        lastFullIndex = i;
        accumulatedLiters = 0;
        accumulatedAmount = 0;
      }
      return {...row, efficiency, costPerKm, distance, cycleLiters, cycleAmount, efficiencyEstimated};
    });
  }
  function fuelDistanceText(row){
    const distance=Number(row?.distanceProvided)>0?Number(row.distanceProvided):Number(row?.distance)>0?Number(row.distance):null;
    if(!distance)return '-';
    const combined=!row.distanceProvided&&Number(row.cycleLiters)>Number(row.liters||0)+0.01;
    const label=row.distanceEstimated?'估算':combined?'合併週期':row.distanceProvided?'原始紀錄':'計算';
    return `${num(distance)} km <span class="estimated-mark">${label}</span>`;
  }
  function fuelRowsForAnalysis(vehicleId){const rows=vfById(vehicleId);return state.fuelAnalysisMode==='confirmed'?rows.filter(x=>x.userConfirmed||x.dataQualityStatus==='confirmed'):rows.filter(x=>x.dataQualityStatus!=='review');}
  function computeFuelRowsForVehicle(vehicleId){ return computeFuelRows(fuelRowsForAnalysis(vehicleId)); }

  function weightedFuelStats(rows){
    const valid=(rows||[]).filter(x=>Number(x.distance)>0&&Number(x.cycleLiters)>0);
    const distance=valid.reduce((s,x)=>s+Number(x.distance||0),0);
    const liters=valid.reduce((s,x)=>s+Number(x.cycleLiters||0),0);
    const amount=valid.reduce((s,x)=>s+Number(x.cycleAmount||0),0);
    return {rows:valid,distance,liters,amount,efficiency:liters>0?distance/liters:null,costPerKm:distance>0?amount/distance:null};
  }
  function percentile(values,p){
    const arr=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!arr.length)return null;if(arr.length===1)return arr[0];
    const index=(arr.length-1)*p;const lo=Math.floor(index),hi=Math.ceil(index);return arr[lo]+(arr[hi]-arr[lo])*(index-lo);
  }
  function efficiencyGrade(ratio){
    if(!Number.isFinite(ratio))return {label:'資料不足',className:'neutral',score:null};
    const score=Math.max(0,Math.min(130,Math.round(ratio*100)));
    if(ratio>=1.05)return {label:'優',className:'excellent',score};
    if(ratio>=0.95)return {label:'良好',className:'good',score};
    if(ratio>=0.85)return {label:'普通',className:'normal',score};
    return {label:'需注意',className:'warning',score};
  }
  function fuelPerformanceForVehicle(vehicleId,windowSetting='5'){
    const vehicle=vehicleById(vehicleId);
    const valid=computeFuelRowsForVehicle(vehicleId).filter(x=>Number(x.efficiency)>0&&Number(x.distance)>0&&Number(x.cycleLiters)>0);
    const count=windowSetting==='all'?valid.length:Math.max(1,Number(windowSetting)||5);
    const selected=windowSetting==='all'?valid:valid.slice(-count);
    const recent=weightedFuelStats(selected);
    const overall=weightedFuelStats(valid);
    const benchmark=hasPositiveNumber(vehicle.benchmarkEfficiency)?Number(vehicle.benchmarkEfficiency):null;
    const tank=hasPositiveNumber(vehicle.fuelTankCapacity)?Number(vehicle.fuelTankCapacity):null;
    const reserve=tank!=null?Math.max(0,Math.min(Number(vehicle.reserveLiters)||tank*.1,tank*.4)):null;
    const usable=tank!=null?Math.max(0,tank-reserve):null;
    const efficiencies=selected.map(x=>Number(x.efficiency)).filter(Number.isFinite);
    const avg=recent.efficiency;
    const rawConservativeEff=percentile(efficiencies,efficiencies.length>=4?.25:0);
    const conservativeEff=avg&&rawConservativeEff?Math.min(rawConservativeEff,avg*.95):rawConservativeEff;
    const fullRange=avg&&tank?avg*tank:null;
    const safeRange=avg&&usable?avg*usable:null;
    const conservativeRange=conservativeEff&&usable?conservativeEff*usable:null;
    const observedAverage=selected.length?selected.reduce((s,x)=>s+Number(x.distance||0),0)/selected.length:null;
    const observedBest=selected.length?Math.max(...selected.map(x=>Number(x.distance)||0)):null;
    const ratio=avg&&benchmark?avg/benchmark:null;
    const grade=efficiencyGrade(ratio);
    const mean=efficiencies.length?efficiencies.reduce((s,x)=>s+x,0)/efficiencies.length:null;
    const variance=efficiencies.length>1?efficiencies.reduce((s,x)=>s+(x-mean)**2,0)/efficiencies.length:0;
    const cv=mean?Math.sqrt(variance)/mean:null;
    const estimatedCount=selected.filter(x=>x.efficiencyEstimated).length;
    const trend=avg&&overall.efficiency?avg/overall.efficiency-1:null;
    const quality=valid.length>=5?(estimatedCount?'可評估（含估算）':'完整'):valid.length>=2?'初步可評估':'資料不足';
    return {vehicle,valid,selected,recent,overall,benchmark,tank,reserve,usable,conservativeEff,avg,fullRange,safeRange,conservativeRange,observedAverage,observedBest,ratio,grade,cv,estimatedCount,trend,quality,costPer100Km:recent.costPerKm!=null?recent.costPerKm*100:null};
  }
  function performanceRelativeText(value,benchmark){
    if(!value||!benchmark)return '未設定參考值';
    const ratio=value/benchmark;
    if(ratio>=1.05)return `高於參考值 ${num((ratio-1)*100,0)}%`;
    if(ratio>=.95)return `接近參考值（${num(ratio*100,0)}%）`;
    return `低於參考值 ${num((1-ratio)*100,0)}%`;
  }
  function performanceStrengths(pf){
    const out=[];
    if(pf.avg&&pf.benchmark&&pf.ratio>=.95)out.push(`近期加權油耗 ${num(pf.avg,2)} km/L，${performanceRelativeText(pf.avg,pf.benchmark)}。`);
    if(pf.cv!=null&&pf.cv<=.08)out.push(`近期油耗波動僅 ${num(pf.cv*100,1)}%，表現相對穩定。`);
    if(pf.safeRange>=450)out.push(`扣除安全預留油量後，估計仍可行駛約 ${num(pf.safeRange)} km，長途續航能力不差。`);
    if(pf.trend!=null&&pf.trend>.02)out.push(`近期油耗較全部歷史平均提升 ${num(pf.trend*100,1)}%。`);
    if(pf.costPer100Km!=null&&pf.costPer100Km<450)out.push(`依近期實付金額估算，每100公里油費約 ${money(pf.costPer100Km)}。`);
    if(!out.length&&pf.avg)out.push(`目前已有 ${pf.valid.length} 個有效油耗週期，可持續累積形成更可靠的長期基準。`);
    if(!out.length)out.push('目前有效油耗資料不足，暫時無法判斷優點。');
    return out;
  }
  function performanceWeaknesses(pf){
    const out=[];
    if(!pf.avg)out.push('至少需要兩次加滿且有里程的紀錄，才能形成一個有效油耗週期。');
    if(pf.avg&&pf.benchmark&&pf.ratio<.95)out.push(`近期油耗為參考值的 ${num(pf.ratio*100,0)}%，仍有約 ${num((1-pf.ratio)*100,0)}% 的改善空間。`);
    if(pf.cv!=null&&pf.cv>.12)out.push(`近期油耗波動 ${num(pf.cv*100,1)}% 偏大，可能受短程、市區壅塞、冷氣、載重或車況影響。`);
    if(pf.estimatedCount)out.push(`選取週期中有 ${pf.estimatedCount} 筆使用推估里程或推定加滿，評價應視為趨勢參考。`);
    if(!pf.tank)out.push('尚未設定油箱容量，因此無法估算完整油箱續航。');
    if(pf.tank&&pf.reserve==null)out.push('尚未設定安全預留油量，無法計算保守可用續航。');
    if(pf.safeRange&&pf.safeRange<400)out.push(`安全續航約 ${num(pf.safeRange)} km，長途行駛時需要較早安排加油。`);
    if(pf.selected.length<5)out.push(`目前評估只採 ${pf.selected.length} 個有效週期，建議至少累積5次以上再判斷長期優劣。`);
    if(!out.length)out.push('目前沒有明顯異常；仍建議持續記錄胎壓、路況與冷氣使用，方便解釋油耗變化。');
    return out;
  }


  function averageDailyMileage(vehicleId){
    const points=mileagePointsForVehicle(vehicleId).filter(p=>p.date<=today());
    if(points.length<2)return null;
    const last=points.at(-1);const cutoff=new Date(`${last.date}T00:00:00`);cutoff.setDate(cutoff.getDate()-180);
    const recent=points.filter(p=>parseDate(p.date)>=cutoff);
    const first=recent[0]||points[0];const days=Math.max(1,Math.round((parseDate(last.date)-parseDate(first.date))/86400000));
    const distance=last.odometer-first.odometer;
    return distance>0?distance/days:null;
  }
  function reminderInfoForVehicle(vehicleId, reminder){
    const vehicle=vehicleById(vehicleId);const daily=averageDailyMileage(vehicleId);
    const km=reminder.targetKm!=null?Number(reminder.targetKm)-Number(vehicle.odometer):null;
    const days=reminder.targetDate?daysUntil(reminder.targetDate):null;
    const kmDays=km!=null&&daily?Math.ceil(km/daily):null;
    const overdue=(km!=null&&km<0)||(days!=null&&days<0);
    const effective=[days,kmDays].filter(x=>x!=null&&Number.isFinite(x));
    const effectiveDays=effective.length?Math.min(...effective):Number.POSITIVE_INFINITY;
    const urgent=!overdue&&((days!=null&&days<=30)||(km!=null&&km<=1000));
    const soon=!overdue&&!urgent&&((days!=null&&days<=90)||(km!=null&&km<=3000));
    const bucket=overdue?0:urgent?1:soon?2:3;
    return {reminder,km,days,kmDays,daily,effectiveDays,bucket};
  }
  function reminderCategoryPriority(reminder){
    const title=String(reminder?.title||'');
    const category=String(reminder?.category||'');
    if(reminder?.sourceType==='obligation'||['保險','驗車','稅費','牌照稅','燃料使用費','公路養管費'].includes(category))return 0;
    if(/待建立基準|補建檢查紀錄/.test(title))return 4;
    if(reminder?.sourceType==='part-standard'){
      const standardId=String(reminder.sourceId||'').split(':').at(-1);
      const std=(state.partStandards||[]).find(x=>x.id===standardId);
      if(std&&['critical','high'].includes(std.safety))return 1;
      return 2;
    }
    if(reminder?.sourceType==='maintenance'||['定期保養','輪胎','電瓶','煞車'].includes(category))return 2;
    return 3;
  }
  function priorityReminderForVehicle(vehicleId){
    const items=vrById(vehicleId).map(r=>({...reminderInfoForVehicle(vehicleId,r),categoryPriority:reminderCategoryPriority(r)}));
    return items.sort((a,b)=>a.categoryPriority-b.categoryPriority||a.bucket-b.bucket||a.effectiveDays-b.effectiveDays||(a.days??999999)-(b.days??999999)||(a.km??999999999)-(b.km??999999999))[0]||null;
  }
  function reminderRemainingText(info){
    if(!info)return '目前沒有提醒';
    if(String(info.reminder?.title||'').includes('繳納狀態待確認'))return '請確認是否已繳';
    const parts=[];
    if(info.km!=null)parts.push(info.km<0?`逾期 ${num(Math.abs(info.km))} km`:info.km===0?'已到目標里程':`剩餘 ${num(info.km)} km`);
    if(info.days!=null)parts.push(info.days<0?`逾期 ${Math.abs(info.days)} 天`:info.days===0?'今天到期':`${info.days} 天內`);
    return parts.length?parts.join('／'):'未設定期限';
  }
  function nextReminderTextForVehicle(vehicleId){
    const info=priorityReminderForVehicle(vehicleId);
    return info?`${info.reminder.title}：${reminderRemainingText(info)}`:'目前沒有提醒';
  }
  function metricsForVehicle(vehicleId){
    const vehicle = vehicleById(vehicleId);
    const fuelRows = computeFuelRowsForVehicle(vehicleId);
    const valid = fuelRows.filter(x=>x.efficiency);
    const thisMonth = today().slice(0,7);
    const thisYear = today().slice(0,4);
    const latestRow=valid.at(-1);const latestEff = latestRow?.efficiency || 0;const latestEffEstimated=!!latestRow?.efficiencyEstimated;
    const fuelMonth = fuelRows.filter(x=>monthKey(x.date)===thisMonth).reduce((s,x)=>s+Number(x.amount||0),0);
    const maintRows = vmById(vehicleId);
    const maintYear = maintRows.filter(x=>x.date.startsWith(thisYear)).reduce((s,x)=>s+Number(x.total||0),0);
    const fuelYear = fuelRows.filter(x=>x.date.startsWith(thisYear)).reduce((s,x)=>s+Number(x.amount||0),0);
    const distanceInfo=calculateYearDistance(vehicleId,thisYear);
    const yearDistance=distanceInfo.distance;
    const recentValid=valid.slice(-3);const recentDistance=recentValid.reduce((s,x)=>s+(Number(x.distance)||0),0);const recentCost=recentValid.reduce((s,x)=>s+(Number(x.cycleAmount)||0),0);
    const fuelCostKm = recentDistance>0?recentCost/recentDistance:0;
    const nextReminder=priorityReminderForVehicle(vehicleId);
    return {vehicle, fuelRows, valid, latestEff, latestEffEstimated, fuelMonth, maintYear, fuelYear, yearDistance, distanceInfo, fuelCostKm, nextReminder};
  }
  function metrics(){ return metricsForVehicle(state.activeVehicleId); }

  const MAINTENANCE_BENEFIT_META = {
    safety:{label:'安全相關',color:'#ff6d7b',weight:100},
    preventive:{label:'預防保養',color:'#49c96b',weight:92},
    reliability:{label:'可靠度修復',color:'#2f8cff',weight:86},
    comfort:{label:'舒適便利',color:'#f2a62b',weight:60},
    cosmetic:{label:'外觀／事故',color:'#8b65ff',weight:35},
    other:{label:'其他／待確認',color:'#8294a8',weight:65}
  };

  function vehicleAgeInfo(vehicle, asOf=today()){
    const raw=vehicle?.manufactureDate||'';
    let year=null,month=1;
    if(/^\d{4}-\d{2}$/.test(raw)){[year,month]=raw.split('-').map(Number);}else if(Number(vehicle?.year)){year=Number(vehicle.year);month=1;}
    if(!year)return {months:null,years:null,extraMonths:null,label:'未設定製造年月',stage:'資料不足',stageKey:'unknown'};
    const end=parseDate(asOf)||new Date();
    const months=Math.max(0,(end.getFullYear()-year)*12+(end.getMonth()+1-month));
    const years=Math.floor(months/12),extraMonths=months%12;
    let stage='新車期',stageKey='new';
    if(years>=21){stage='高齡老車期';stageKey='very-old';}
    else if(years>=16){stage='老化風險期';stageKey='old';}
    else if(years>=11){stage='中高車齡期';stageKey='mature';}
    else if(years>=6){stage='耗材更換期';stageKey='mid';}
    return {months,years,extraMonths,label:`${years} 年${extraMonths?` ${extraMonths} 個月`:''}`,stage,stageKey};
  }

  function estimatedAnnualMileage(vehicleId){
    const points=mileagePointsForVehicle(vehicleId).filter(x=>hasPositiveNumber(x.odometer)).sort((a,b)=>a.date.localeCompare(b.date));
    if(points.length<2)return {value:null,quality:'里程資料不足',days:null,distance:null,estimatedCount:points.filter(x=>x.estimated).length};
    const last=points.at(-1);const cutoff=new Date(parseDate(last.date));cutoff.setFullYear(cutoff.getFullYear()-3);
    const recent=points.filter(x=>parseDate(x.date)>=cutoff);
    const first=recent.length>=2?recent[0]:points[0];
    const days=Math.max(1,Math.round((parseDate(last.date)-parseDate(first.date))/86400000));
    const distance=Number(last.odometer)-Number(first.odometer);
    const value=distance>0?distance/days*365.25:null;
    const estimatedCount=[first,last].filter(x=>x.estimated).length;
    return {value,quality:value?`${estimatedCount?'含估算里程':'以實際里程'}，涵蓋 ${num(days)} 天`:'里程區間無法計算',days,distance,estimatedCount};
  }

  function maintenanceProfileForAge(age){
    const profiles=(state.maintenanceAgeProfiles||DEFAULT_MAINTENANCE_AGE_PROFILES).slice().sort((a,b)=>a.minAge-b.minAge);
    const value=Math.max(0,Number(age)||0);
    return profiles.find(p=>value>=Number(p.minAge||0)&&(p.maxAge==null||value<=Number(p.maxAge)))||profiles.at(-1)||DEFAULT_MAINTENANCE_AGE_PROFILES.at(-1);
  }
  function maintenanceMileageFactor(annualMileage){
    const km=Math.max(0,Number(annualMileage)||0);
    if(km===0)return {value:1,label:'未設定年里程'};
    if(km<5000)return {value:.9,label:'低里程（未滿5,000 km／年）'};
    if(km<10000)return {value:1,label:'一般低里程（5,000–9,999 km／年）'};
    if(km<15000)return {value:1.12,label:'一般使用（10,000–14,999 km／年）'};
    if(km<25000)return {value:1.28,label:'高里程（15,000–24,999 km／年）'};
    return {value:1.5,label:'重度高里程（25,000 km／年以上）'};
  }
  function maintenanceScenarioForAge(age,annualMileage=10000,costFactor=1){
    const profile=maintenanceProfileForAge(age);const mileageFactor=maintenanceMileageFactor(annualMileage);const modelFactor=Math.max(.5,Math.min(3,Number(costFactor)||1));
    const low=Math.round(profile.budgetLow*mileageFactor.value*modelFactor/1000)*1000;
    const high=Math.round(profile.budgetHigh*mileageFactor.value*modelFactor/1000)*1000;
    const reserve=Math.round(profile.reserveFund*Math.max(1,modelFactor)/1000)*1000;
    const threshold=Math.max(25000,Math.round(high*.5/1000)*1000);
    return {profile,age:Number(age)||0,annualMileage:Number(annualMileage)||0,mileageFactor,modelFactor,low,high,mid:(low+high)/2,reserve,threshold,reference:`${profile.label}資料庫基準 × ${mileageFactor.label} × 車款成本係數 ${num(modelFactor,2)}`};
  }
  function automaticMaintenanceBudget(vehicle,{ageOverride=null,annualMileageOverride=null,useVehicleOverride=true}={}){
    const age=ageOverride==null?vehicleAgeInfo(vehicle).years:Number(ageOverride);
    const mileage=annualMileageOverride==null?estimatedAnnualMileage(vehicle.id).value:Number(annualMileageOverride);
    const scenario=maintenanceScenarioForAge(age??0,mileage||10000,vehicle?.maintenanceCostFactor||1);
    let low=scenario.low,high=scenario.high,source='車齡資料庫動態計算';
    const customLow=nullableNumber(vehicle?.maintenanceBudgetLow),customHigh=nullableNumber(vehicle?.maintenanceBudgetHigh);
    if(useVehicleOverride&&(customLow!=null||customHigh!=null)){if(customLow!=null)low=customLow;if(customHigh!=null)high=customHigh;source='車輛自訂預算覆寫';}
    if(high<low)[low,high]=[high,low];
    const threshold=useVehicleOverride&&nullableNumber(vehicle?.majorRepairThreshold)!=null?nullableNumber(vehicle.majorRepairThreshold):Math.max(scenario.threshold,Math.round((high*.5)/1000)*1000);
    const reference=useVehicleOverride&&vehicle?.maintenanceBudgetReference?vehicle.maintenanceBudgetReference:`${scenario.reference}。此為規劃資料庫估算，可依保修廠、零件等級、車況及持有策略調整。`;
    return {low,high,mid:(low+high)/2,threshold,band:scenario.profile.label,reference,custom:source==='車輛自訂預算覆寫',source,scenario,profile:scenario.profile};
  }

  function classifyMaintenanceBenefit(text='',type=''){
    const s=`${text} ${type}`.toLowerCase();
    if(/煞車|來令|方向機|三角架|拉桿|避震|羊角|定位|真空管|輪胎|轉向/.test(s))return 'safety';
    if(/冷氣|蒸發器|冷媒|空調|升降機|車窗|內把手|風向馬達/.test(s))return 'comfort';
    if(/機油|油心|機油芯|放油螺絲|濾清器|濾網|噴油嘴清洗|清洗劑|火星塞|自動油|變速箱油|冷卻液|煞車油|保養及檢修|定期保養/.test(s))return 'preventive';
    if(/發電機|曲軸|皮帶|幫浦|傳動軸|防塵套|搖臂|節氣門|岐管|墊片|漏油|油封|引擎|變速箱|電瓶|馬達|水箱|水幫浦/.test(s))return 'reliability';
    if(/鈑金|烤漆|事故|外觀|美容/.test(s))return 'cosmetic';
    if(type==='定期保養')return 'preventive';
    if(type==='故障維修')return 'reliability';
    if(type==='事故維修'||type==='鈑金烤漆')return 'cosmetic';
    return 'other';
  }

  function maintenanceOrderAssessment(order,budget){
    const totals=Object.fromEntries(Object.keys(MAINTENANCE_BENEFIT_META).map(k=>[k,0]));
    const details=Array.isArray(order.details)?order.details:[];
    let accounted=0;
    if(details.length){
      details.forEach(d=>{const amount=Math.max(0,Number(d.amount)||0);const key=classifyMaintenanceBenefit(`${d.name||''} ${d.note||''}`,order.type);totals[key]+=amount;accounted+=amount;});
    }
    const remainder=Math.max(0,Number(order.total||0)-accounted);
    if(remainder>0)totals[classifyMaintenanceBenefit(`${order.items||''} ${order.notes||''}`,order.type)]+=remainder;
    if(!details.length&&Number(order.total||0)>0)totals[classifyMaintenanceBenefit(`${order.items||''} ${order.notes||''}`,order.type)]=Number(order.total||0);
    const total=Math.max(0,Number(order.total)||Object.values(totals).reduce((a,b)=>a+b,0));
    const dominant=Object.entries(totals).sort((a,b)=>b[1]-a[1])[0]?.[0]||'other';
    const essential=totals.safety+totals.preventive+totals.reliability;
    const benefitScore=total>0?Object.entries(totals).reduce((s,[k,v])=>s+v*MAINTENANCE_BENEFIT_META[k].weight,0)/total:0;
    const oneOff=total>=budget.threshold;
    let necessity='中';
    if(dominant==='safety'||dominant==='preventive'||dominant==='reliability'||essential/Math.max(total,1)>=.7)necessity='高';
    else if(dominant==='cosmetic')necessity='低';
    const labels=Object.entries(totals).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k])=>MAINTENANCE_BENEFIT_META[k].label);
    const explanation=dominant==='safety'?'主要降低煞車、轉向、底盤或行車安全風險。':dominant==='preventive'?'屬於定期維護或油液耗材，可降低後續故障機率。':dominant==='reliability'?'主要恢復引擎、傳動、電系或機械可靠度。':dominant==='comfort'?'主要改善冷氣、車窗或日常使用便利性。':dominant==='cosmetic'?'主要處理外觀或事故修復，對機械可靠度的直接效益較低。':'項目分類不足，建議補充故障症狀與更換原因。';
    return {order,totals,total,dominant,essential,essentialRatio:total?essential/total:0,benefitScore,oneOff,necessity,labels,explanation};
  }

  function maintenanceWindowInfo(vehicleId,windowValue='5'){
    const currentYear=Number(today().slice(0,4));
    const all=vmById(vehicleId).slice().sort((a,b)=>a.date.localeCompare(b.date));
    let startYear,endYear,years=[];
    if(windowValue==='all'){
      startYear=all.length?Number(all[0].date.slice(0,4)):currentYear;
      endYear=currentYear;
    }else{
      const count=Math.max(1,Number(windowValue)||5);endYear=currentYear-1;startYear=endYear-count+1;
    }
    for(let y=startYear;y<=endYear;y++)years.push(y);
    const rows=all.filter(x=>{const y=Number(x.date.slice(0,4));return y>=startYear&&y<=endYear;});
    return {rows,years,startYear,endYear,label:windowValue==='all'?`${startYear}–${endYear} 全部已輸入紀錄`:`${startYear}–${endYear}（${years.length}個完整年度）`};
  }

  function maintenanceEvaluationForVehicle(vehicleId,windowValue='5'){
    const vehicle=vehicleById(vehicleId);const age=vehicleAgeInfo(vehicle);const mileage=estimatedAnnualMileage(vehicleId);const budget=automaticMaintenanceBudget(vehicle,{annualMileageOverride:mileage.value});const windowInfo=maintenanceWindowInfo(vehicleId,windowValue);
    const assessments=windowInfo.rows.map(x=>maintenanceOrderAssessment(x,budget));
    const years=windowInfo.years.map(year=>{
      const items=assessments.filter(x=>Number(x.order.date.slice(0,4))===year);const total=items.reduce((s,x)=>s+x.total,0);const preventive=items.reduce((s,x)=>s+x.totals.preventive,0);const major=items.filter(x=>x.oneOff).reduce((s,x)=>s+x.total,0);
      return {year,age:vehicleAgeInfo(vehicle,`${year}-12-31`).years,items,total,preventive,repair:Math.max(0,total-preventive),major};
    });
    const total=assessments.reduce((s,x)=>s+x.total,0);const calendarYears=Math.max(1,windowInfo.years.length);const spendingYears=years.filter(x=>x.total>0).length;const actualAvg=total/calendarYears;const activeYearAvg=spendingYears?total/spendingYears:0;
    const oneOffTotal=assessments.filter(x=>x.oneOff).reduce((s,x)=>s+x.total,0);const normalizedAvg=Math.max(0,total-oneOffTotal)/calendarYears;
    const categoryTotals=Object.fromEntries(Object.keys(MAINTENANCE_BENEFIT_META).map(k=>[k,assessments.reduce((s,x)=>s+x.totals[k],0)]));
    const essentialTotal=categoryTotals.safety+categoryTotals.preventive+categoryTotals.reliability;const essentialRatio=total?essentialTotal/total:0;
    const benefitScore=total?assessments.reduce((s,x)=>s+x.benefitScore*x.total,0)/total:null;
    let budgetStatus='資料不足',budgetScore=55;
    if(total>0){
      if(actualAvg<budget.low*.5){budgetStatus='明顯低於規劃範圍';budgetScore=65;}
      else if(actualAvg<budget.low){budgetStatus='低於規劃範圍';budgetScore=76;}
      else if(actualAvg<=budget.high){budgetStatus='合理範圍';budgetScore=92;}
      else{budgetStatus='高於規劃範圍';budgetScore=Math.max(35,92-((actualAvg-budget.high)/Math.max(budget.high,1))*60);}
    }
    const finalScore=benefitScore==null?null:Math.round(benefitScore*.75+budgetScore*.25);
    const grade=finalScore==null?{label:'資料不足',key:'warn'}:finalScore>=85?{label:'優',key:'good'}:finalScore>=75?{label:'良好',key:'good'}:finalScore>=60?{label:'普通',key:'normal'}:{label:'需檢視',key:'warn'};
    const missingYears=years.filter(x=>x.total===0).length;
    const strengths=[];const warnings=[];
    if(essentialRatio>=.75)strengths.push(`安全、預防保養與可靠度修復占 ${num(essentialRatio*100,0)}%，多數支出具有明確使用效益。`);
    else if(total>0)warnings.push(`必要性較高的支出占 ${num(essentialRatio*100,0)}%，建議確認舒適或其他項目是否符合使用需求。`);
    if(actualAvg>=budget.low&&actualAvg<=budget.high)strengths.push(`選定期間年均支出 ${money(actualAvg)}，落在規劃範圍內。`);
    if(actualAvg<budget.low&&total>0)warnings.push(`年均支出低於規劃下限；可能是低里程使用，也可能有工單尚未輸入，不能直接判定一定省錢。`);
    if(actualAvg>budget.high)warnings.push(`年均支出高於規劃上限，應檢查是否集中在一次性大修、重複維修或誤判更換。`);
    if(oneOffTotal>0)strengths.push(`已將 ${money(oneOffTotal)} 一次性大修獨立標示，避免把單一年份高額支出誤認為每年固定成本。`);
    if(age.years>=20)warnings.push(`車齡已達 ${age.label}，橡膠、油封、冷卻、電系、底盤及空調零件的時間老化風險較高。`);
    if(mileage.value!=null&&mileage.value<6000)strengths.push(`年均行駛約 ${num(mileage.value)} km，里程耗損偏低；仍需注意與時間有關的老化項目。`);
    if(missingYears>0)warnings.push(`選定期間有 ${missingYears} 個年度沒有工單，0元可能代表無維修，也可能代表資料尚未補齊。`);
    if(!vehicle.maintenanceMode||vehicle.maintenanceMode==='不定期保養')warnings.push('目前設定為不定期保養，建議至少建立每年一次的油液、煞車、輪胎、冷卻與底盤檢查提醒。');
    return {vehicle,age,budget,mileage,windowInfo,assessments,years,total,calendarYears,spendingYears,actualAvg,activeYearAvg,oneOffTotal,normalizedAvg,categoryTotals,essentialTotal,essentialRatio,benefitScore,budgetStatus,budgetScore,finalScore,grade,missingYears,strengths,warnings};
  }


  function renderAgeDatabaseSimulation(){
    const v=activeVehicle();const actualAge=vehicleAgeInfo(v).years??10;const estimatedMileage=Math.round(estimatedAnnualMileage(v.id).value||10000);
    const ageInput=$('#ageSimulationAge'),mileageInput=$('#ageSimulationMileage'),factorInput=$('#ageSimulationCostFactor');
    if(isReal(ageInput)&&ageInput.dataset.ready!=='1'){ageInput.value=actualAge;ageInput.dataset.ready='1';}
    if(isReal(mileageInput)&&mileageInput.dataset.ready!=='1'){mileageInput.value=estimatedMileage;mileageInput.dataset.ready='1';}
    if(isReal(factorInput)&&factorInput.dataset.ready!=='1'){factorInput.value=Number(v.maintenanceCostFactor)||1;factorInput.dataset.ready='1';}
    const age=Math.max(0,Number(ageInput.value)||0);const mileage=Math.max(0,Number(mileageInput.value)||0);const factor=Math.max(.5,Number(factorInput.value)||1);const scenario=maintenanceScenarioForAge(age,mileage,factor);const p=scenario.profile;
    $('#ageDatabaseKpis').innerHTML=[
      ['模擬車齡',`${num(age)} 年`,p.label,'#2f8cff'],['動態年度預算',`${money(scenario.low)}～${money(scenario.high)}`,scenario.mileageFactor.label,'#f2a62b'],['突發維修準備金',money(scenario.reserve),'建議獨立預留，不代表每年一定支出','#ff6d7b'],['建議檢查頻率',`每 ${num(p.checkMonths)} 個月`,`${p.eventMin}～${p.eventMax} 次年度維修／保養事件參考`,'#3dd6d0']
    ].map(c=>`<article class="kpi-card" style="--accent:${c[3]}"><div class="kpi-top"><span class="kpi-icon">▦</span><span>${c[0]}</span></div><div class="kpi-value">${c[1]}</div><div class="kpi-foot"><i></i></div><div class="kpi-note">${esc(c[2])}</div></article>`).join('');
    $('#ageProfileTimeline').innerHTML=(state.maintenanceAgeProfiles||[]).map(profile=>{const active=profile.id===p.id;const range=profile.maxAge==null?`${profile.minAge}年以上`:`${profile.minAge}–${profile.maxAge}年`;return `<button type="button" class="age-profile-card ${active?'active':''}" data-select-profile-age="${profile.minAge}"><small>${range}</small><strong>${esc(profile.label)}</strong><span>${money(profile.budgetLow)}～${money(profile.budgetHigh)}</span></button>`;}).join('');
    $('#ageRiskMatrix').innerHTML=Object.entries(AGE_RISK_LABELS).map(([key,label])=>{const level=Math.max(1,Math.min(5,Number(p.risk?.[key])||1));return `<div class="age-risk-row"><span>${label}</span><div class="age-risk-track"><i style="width:${level/5*100}%"></i></div><b>${level}/5</b></div>`;}).join('');
    $('#ageFocusList').innerHTML=`<div class="age-scenario-summary"><span class="maintenance-stage-badge ${vehicleAgeInfo({manufactureDate:`${new Date().getFullYear()-age}-01`}).stageKey}">${esc(p.label)}</span><h3>${esc(p.description)}</h3><p>${esc(scenario.reference)}</p></div>`+(p.focus||[]).map(x=>`<div><span>✓</span><p>${esc(x)}</p></div>`).join('');
    $('#ageDatabaseBody').innerHTML=(state.maintenanceAgeProfiles||[]).map(profile=>`<tr><td>${profile.maxAge==null?`${profile.minAge}年以上`:`${profile.minAge}–${profile.maxAge}年`}</td><td><strong>${esc(profile.label)}</strong><small class="table-subline">${esc(profile.description)}</small></td><td>${money(profile.budgetLow)}～${money(profile.budgetHigh)}</td><td>${money(profile.reserveFund)}</td><td>${profile.checkMonths}個月</td><td>${profile.eventMin}～${profile.eventMax}次</td><td>${(profile.focus||[]).map(esc).join('、')}</td><td><button class="action-btn" data-edit-age-profile="${profile.id}">編輯</button></td></tr>`).join('');
  }

  function openAgeProfileModal(id){
    const row=(state.maintenanceAgeProfiles||[]).find(x=>x.id===id);if(!row)return;
    const r=row.risk||{};
    openModal({eyebrow:'車齡維修資料庫',title:`編輯 ${row.label}`,submitText:'儲存資料庫階段',fields:[
      ['label','階段名稱','text',row.label,true],['minAge','起始車齡','number',row.minAge,true],['maxAge','結束車齡（最高階段可留空）','number',row.maxAge??'',false],['budgetLow','年度預算下限','number',row.budgetLow,true],['budgetHigh','年度預算上限','number',row.budgetHigh,true],['reserveFund','突發維修準備金','number',row.reserveFund,true],['checkMonths','建議檢查月數','number',row.checkMonths,true],['eventMin','年度事件下限','number',row.eventMin,true],['eventMax','年度事件上限','number',row.eventMax,true],['description','階段說明','textarea',row.description,false],['focus','重點項目（逗號分隔）','textarea',(row.focus||[]).join('、'),false],['riskRoutine','例行保養風險1–5','number',r.routine||1,true],['riskRubber','橡膠／油封風險1–5','number',r.rubber||1,true],['riskCooling','冷卻系統風險1–5','number',r.cooling||1,true],['riskElectrical','電系風險1–5','number',r.electrical||1,true],['riskSuspension','底盤／懸吊風險1–5','number',r.suspension||1,true],['riskTransmission','引擎／傳動風險1–5','number',r.transmission||1,true],['riskAc','空調／便利風險1–5','number',r.ac||1,true]
    ],onSubmit:data=>{
      const minAge=Math.max(0,Number(data.minAge)||0);const maxAge=data.maxAge===''?null:Math.max(0,Number(data.maxAge));if(maxAge!=null&&maxAge<minAge)return toast('結束車齡不可小於起始車齡。','error');
      const low=Math.max(0,Number(data.budgetLow)||0),high=Math.max(0,Number(data.budgetHigh)||0);if(high<low)return toast('年度預算上限不可低於下限。','error');
      Object.assign(row,{label:data.label,minAge,maxAge,budgetLow:low,budgetHigh:high,reserveFund:Math.max(0,Number(data.reserveFund)||0),checkMonths:Math.max(1,Number(data.checkMonths)||1),eventMin:Math.max(0,Number(data.eventMin)||0),eventMax:Math.max(0,Number(data.eventMax)||0),description:data.description||'',focus:String(data.focus||'').split(/[,，、\n]/).map(x=>x.trim()).filter(Boolean),risk:{routine:Number(data.riskRoutine)||1,rubber:Number(data.riskRubber)||1,cooling:Number(data.riskCooling)||1,electrical:Number(data.riskElectrical)||1,suspension:Number(data.riskSuspension)||1,transmission:Number(data.riskTransmission)||1,ac:Number(data.riskAc)||1}});
      state.maintenanceAgeProfiles.sort((a,b)=>a.minAge-b.minAge);closeModal();renderAll();toast('車齡資料庫階段已更新');
    }});
  }



  function monthsBetween(a,b){
    const start=parseDate(a),end=parseDate(b);if(!start||!end)return null;
    return Math.max(0,(end.getFullYear()-start.getFullYear())*12+(end.getMonth()-start.getMonth())+(end.getDate()-start.getDate())/30.44);
  }
  function partAgeIntervalFactor(age){
    if(age==null||age<=5)return {km:1,months:1};
    if(age<=8)return {km:.95,months:.9};
    if(age<=12)return {km:.9,months:.85};
    if(age<=15)return {km:.85,months:.8};
    if(age<=20)return {km:.8,months:.75};
    return {km:.75,months:.7};
  }
  function standardAppliesToVehicle(std,v){
    if(!std.vehiclePattern)return true;
    try{return new RegExp(std.vehiclePattern,'i').test(`${v.name||''} ${v.notes||''}`);}catch{return true;}
  }
  function maintenanceTextMatches(text,std){
    const hay=String(text||'').toLowerCase();
    if(!hay)return false;
    if((std.excludeAliases||[]).some(a=>hay.includes(String(a).toLowerCase())))return false;
    return (std.aliases||[]).some(a=>hay.includes(String(a).toLowerCase()));
  }
  function maintenanceReplacementTextMatches(text,std){
    const hay=String(text||'').toLowerCase();
    if(!hay)return false;
    if((std.excludeAliases||[]).some(a=>hay.includes(String(a).toLowerCase())))return false;
    return (std.aliases||[]).some(alias=>{
      const key=String(alias||'').toLowerCase();let from=0;
      while(key&&hay.indexOf(key,from)>=0){
        const idx=hay.indexOf(key,from);const nearby=hay.slice(Math.max(0,idx-10),Math.min(hay.length,idx+key.length+10));
        if(/更換|換新|汰換|換裝|更新/.test(nearby))return true;
        from=idx+key.length;
      }
      return false;
    });
  }
  function inferredPartHistory(vehicleId,std){
    const matches=[];
    vmById(vehicleId).forEach(order=>{
      let matchedNames=[];
      (order.details||[]).forEach(d=>{
        const label=`${d.category||''} ${d.name||''} ${d.note||''}`;
        const inspectionOnly=/(檢查|檢測|建議|暫不更換|未更換|持續觀察)/.test(label)||['檢查','免費服務'].includes(String(d.category||''));
        if(!inspectionOnly&&maintenanceTextMatches(d.name,std))matchedNames.push(d.name);
      });
      if(!matchedNames.length&&maintenanceReplacementTextMatches(order.items,std))matchedNames=[order.items];
      if(matchedNames.length)matches.push({date:order.date,odometer:nullableNumber(order.odometer),source:'歷史工單',description:matchedNames.join('、'),orderId:order.id});
    });
    return matches.sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0]||null;
  }
  function manualPartRecord(vehicleId,standardId){return (state.partInspections||[]).find(x=>x.vehicleId===vehicleId&&x.standardId===standardId)||null;}
  function partStandardCycleText(std,effective){
    const replace=[];if(effective.km)replace.push(`${num(effective.km)} km`);if(effective.months)replace.push(`${num(effective.months,0)} 個月`);
    const inspect=[];if(std.inspectKm)inspect.push(`${num(std.inspectKm)} km`);if(std.inspectMonths)inspect.push(`${num(std.inspectMonths)} 個月`);
    if(std.mode==='inspect')return `定期檢查：${inspect.join('／')||replace.join('／')||'依車況'}`;
    return `${std.mode==='hybrid'?'檢查／汰換':'汰換'}：${replace.join('／')||'依車況'}${inspect.length?`；檢查 ${inspect.join('／')}`:''}`;
  }
  function partEvaluationForVehicle(vehicleId){
    const v=vehicleById(vehicleId);if(!v)return [];
    const age=vehicleAgeInfo(v).years??0;const factor=partAgeIntervalFactor(age);const now=today();const currentKm=Number(v.odometer)||0;
    return (state.partStandards||[]).filter(std=>standardAppliesToVehicle(std,v)).map(std=>{
      const inferred=inferredPartHistory(vehicleId,std);const manual=manualPartRecord(vehicleId,std.id);
      let lastDate=manual?.lastReplaceDate||inferred?.date||'';
      let lastKm=manual?.lastReplaceOdometer??inferred?.odometer??null;
      if(manual?.lastReplaceDate&&inferred?.date&&inferred.date>manual.lastReplaceDate){lastDate=inferred.date;lastKm=inferred.odometer;}
      const condition=manual?.condition||'unknown';const lastInspectDate=[manual?.lastInspectDate||'',lastDate||''].filter(Boolean).sort().at(-1)||'';
      const elapsedMonths=lastDate?monthsBetween(lastDate,now):null;
      const kmSince=lastKm!=null&&currentKm>=lastKm?currentKm-lastKm:null;
      const effectiveKm=std.intervalKm?Math.max(1000,Math.round(std.intervalKm*(std.ageSensitive?factor.km:1)/500)*500):0;
      const effectiveMonths=std.intervalMonths?Math.max(3,Math.round(std.intervalMonths*(std.ageSensitive?factor.months:1))):0;
      const kmRatio=effectiveKm&&kmSince!=null?kmSince/effectiveKm:null;
      const monthRatio=effectiveMonths&&elapsedMonths!=null?elapsedMonths/effectiveMonths:null;
      const replacementRatio=Math.max(kmRatio??0,monthRatio??0);
      const inspectElapsed=lastInspectDate?monthsBetween(lastInspectDate,now):null;
      const inspectDue=std.inspectMonths&&(!lastInspectDate||inspectElapsed>=std.inspectMonths);
      const staleBaseline=std.mode==='inspect'&&std.inspectMonths&&lastInspectDate&&inspectElapsed>=std.inspectMonths*3;
      const noRecord=!lastDate&&lastKm==null;
      let status='normal',reason='',action='維持例行檢查';
      if(condition==='failed'||condition==='worn'){
        status='due';reason=condition==='failed'?'已記錄故障／失效':'已記錄劣化／磨耗';action=std.mode==='inspect'?'請技師確認並安排必要汰換':'建議優先安排更換或修復';
      }else if(condition==='attention'){
        status='soon';reason='人工檢查已標示注意';action='縮短複查週期並準備汰換';
      }else if(noRecord){
        const shouldHaveRecord=age>=std.firstInspectAge||currentKm>=(std.inspectKm||std.intervalKm||Infinity);
        status=shouldHaveRecord?(std.safety==='critical'||std.safety==='high'?'inspect':'unknown'):'normal';
        reason=shouldHaveRecord?'沒有可追溯的更換／檢查紀錄':'尚未達首次檢查條件';
        action=shouldHaveRecord?(std.mode==='replace'&&std.safety==='critical'?'優先查證歷史；無法確認時安排技師評估是否汰換':'建立現況檢查紀錄'):'依正常週期追蹤';
      }else if(staleBaseline){
        status='unknown';reason='最近可追溯紀錄已超過3個建議檢查週期';action='待建立現況基準';
      }else if(std.mode==='inspect'){
        if(inspectDue||replacementRatio>=1){status='inspect';reason=inspectDue?'距上次檢查已達週期':'已達建議重點檢查里程／時間';action='現場量測／檢查後再決定是否汰換';}
        else if(replacementRatio>=.8){status='soon';reason='接近建議重點檢查區間';action='下次保養時列入重點檢查';}
        else {reason='尚未達重點檢查週期';}
      }else if(replacementRatio>=1){
        status='due';reason=`已達調整後${std.mode==='hybrid'?'檢查／汰換':'汰換'}週期`;action=std.mode==='hybrid'?'先檢查狀況，劣化時汰換':'建議安排更換';
      }else if(replacementRatio>=.8){status='soon';reason='已使用標準週期80%以上';action='可開始編列預算並於下次進廠確認';}
      else if(inspectDue){status='inspect';reason='已達例行檢查週期';action='下次保養時完成檢查並登錄結果';}
      else {reason='仍在標準週期內';}
      if(condition==='normal'&&status==='unknown'){status='normal';reason='最近人工檢查結果正常';}
      const meta=PART_STATUS_META[status]||PART_STATUS_META.unknown;
      return {std,manual,inferred,lastDate,lastKm,elapsedMonths,kmSince,effective:{km:effectiveKm,months:effectiveMonths},replacementRatio,condition,lastInspectDate,status,meta,reason,action,source:manual?.lastReplaceDate?'人工登錄':inferred?'歷史工單':'無紀錄'};
    }).sort((a,b)=>b.meta.rank-a.meta.rank||({critical:4,high:3,medium:2,low:1}[b.std.safety]-({critical:4,high:3,medium:2,low:1}[a.std.safety]))||a.std.category.localeCompare(b.std.category,'zh-Hant'));
  }
  function conditionLabel(value){return (PART_CONDITION_OPTIONS.find(x=>x[0]===value)||PART_CONDITION_OPTIONS[0])[1];}
  function renderPartAssessment(){
    const rows=partEvaluationForVehicle(state.activeVehicleId);const category=$('#partCategoryFilter').value||'';const status=$('#partStatusFilter').value||'';const keyword=($('#partKeywordFilter').value||'').trim().toLowerCase();
    const categories=[...new Set(rows.map(x=>x.std.category))].sort((a,b)=>a.localeCompare(b,'zh-Hant'));const categorySelect=$('#partCategoryFilter');const current=categorySelect.value;categorySelect.innerHTML='<option value="">全部分類</option>'+categories.map(x=>`<option ${x===current?'selected':''}>${esc(x)}</option>`).join('');
    const counts=rows.reduce((acc,x)=>(acc[x.status]=(acc[x.status]||0)+1,acc),{});
    $('#partAssessmentKpis').innerHTML=[['應優先處理',counts.due||0,'#ff6d7b','已超週期或記錄劣化'],['接近汰換',counts.soon||0,'#f2a62b','接近標準80%以上'],['建議檢查',counts.inspect||0,'#2f8cff','需技師檢查後判斷'],['正常',counts.normal||0,'#49c96b','目前仍在標準範圍'],['缺少紀錄',counts.unknown||0,'#8294a8','需補檢查或更換歷史']].map(x=>`<div class="kpi-card" style="--accent:${x[2]}"><div class="kpi-top"><span>${x[0]}</span></div><div class="kpi-value">${x[1]} 項</div><div class="kpi-note">${x[3]}</div></div>`).join('');
    const v=activeVehicle();$('#partAssessmentNotice').innerHTML=`<strong>${esc(v.name)}｜${vehicleAgeInfo(v).label}</strong>　目前里程 ${num(v.odometer)} km。系統已從歷史工單自動辨識最近更換項目；「檢查型」零件不會只因車齡或里程直接判定必須更換。`;
    const filtered=rows.filter(x=>(!category||x.std.category===category)&&(!status||x.status===status)&&(!keyword||`${x.std.name} ${x.std.category} ${x.std.applicability} ${x.std.notes}`.toLowerCase().includes(keyword)));
    $('#partAssessmentBody').innerHTML=filtered.map(x=>{
      const recent=x.lastDate||x.lastKm!=null?`${x.lastDate||'日期未記錄'}${x.lastKm!=null?`<small class="table-subline">${num(x.lastKm)} km｜${esc(x.source)}</small>`:`<small class="table-subline">${esc(x.source)}</small>`}`:'<span class="muted">沒有更換紀錄</span>';
      const used=[x.kmSince!=null?`${num(x.kmSince)} km`:'',x.elapsedMonths!=null?`${num(x.elapsedMonths,1)} 個月`:'' ].filter(Boolean).join('／')||'-';
      const condition=`${conditionLabel(x.condition)}${x.lastInspectDate?`<small class="table-subline">檢查：${esc(x.lastInspectDate)}</small>`:''}`;
      const priority=x.std.safety==='critical'?'關鍵安全':x.std.safety==='high'?'高重要性':x.std.safety==='medium'?'一般重要':'舒適／耗材';
      return `<tr class="part-status-${x.status}"><td><strong>${esc(x.std.name)}</strong><small class="table-subline">${esc(x.std.category)}｜${priority}</small><small class="table-subline">${esc(x.std.applicability)}</small></td><td>${esc(partStandardCycleText(x.std,x.effective))}<small class="table-subline">${x.std.ageSensitive?'已依車齡縮短週期':'不因車齡自動縮短'}</small></td><td>${recent}</td><td>${esc(used)}<small class="table-subline">使用率 ${num(x.replacementRatio*100,0)}%</small></td><td>${condition}</td><td><span class="badge ${x.meta.className}">${x.meta.label}</span></td><td><strong>${esc(x.reason)}</strong><small class="table-subline">${esc(x.action)}</small><small class="table-subline">${esc(x.std.notes)}</small></td><td><button class="action-btn" data-record-part="${x.std.id}">登錄檢查</button><button class="action-btn" data-edit-part-standard="${x.std.id}">編輯標準</button></td></tr>`;
    }).join('')||'<tr><td colspan="8" class="empty">沒有符合篩選條件的零件評估</td></tr>';
  }
  function openPartRecordModal(standardId){
    const std=(state.partStandards||[]).find(x=>x.id===standardId);if(!std)return;const row=manualPartRecord(state.activeVehicleId,standardId);const inferred=inferredPartHistory(state.activeVehicleId,std);
    openModal({eyebrow:'零件檢查／更換紀錄',title:std.name,submitText:'儲存評估紀錄',fields:[['lastReplaceDate','最近更換日期','date',row?.lastReplaceDate||inferred?.date||'',false],['lastReplaceOdometer','最近更換里程','number',row?.lastReplaceOdometer??inferred?.odometer??'',false],['lastInspectDate','最近檢查日期','date',row?.lastInspectDate||today(),false],['condition','檢查狀況','select',row?.condition||'unknown',true,PART_CONDITION_OPTIONS],['notes','檢查結果／症狀／量測值','textarea',row?.notes||'',false]],onSubmit:data=>{const item={id:row?.id||uid(),vehicleId:state.activeVehicleId,standardId,lastReplaceDate:data.lastReplaceDate||'',lastReplaceOdometer:nullableNumber(data.lastReplaceOdometer),lastReplaceOdometerEstimated:!!(row?.lastReplaceOdometerEstimated&&Number(data.lastReplaceOdometer)===Number(row.lastReplaceOdometer)),lastReplaceOdometerEstimateMethod:row?.lastReplaceOdometerEstimateMethod||'',lastInspectDate:data.lastInspectDate||'',condition:data.condition||'unknown',notes:data.notes||''};upsert(state.partInspections,item);closeModal();renderAll();toast(`${std.name}檢查紀錄已儲存`);}});
  }
  function openPartStandardModal(id){
    const row=(state.partStandards||[]).find(x=>x.id===id);if(!row)return;
    openModal({eyebrow:'零件汰換標準資料庫',title:`編輯 ${row.name}`,submitText:'儲存零件標準',fields:[['name','零件／耗材名稱','text',row.name,true],['category','分類','text',row.category,true],['mode','評估方式','select',row.mode,true,[['replace','週期汰換'],['inspect','檢查後決定'],['hybrid','週期＋檢查']]],['intervalKm','汰換里程','number',row.intervalKm||'',false],['intervalMonths','汰換月數','number',row.intervalMonths||'',false],['inspectKm','檢查里程','number',row.inspectKm||'',false],['inspectMonths','檢查月數','number',row.inspectMonths||'',false],['firstInspectAge','首次重點檢查車齡','number',row.firstInspectAge||0,false],['safety','重要程度','select',row.safety,true,[['low','舒適／一般耗材'],['medium','一般重要'],['high','高重要性'],['critical','關鍵安全']]],['aliases','工單辨識關鍵字','textarea',(row.aliases||[]).join('、'),false],['applicability','適用範圍','text',row.applicability||'',false],['notes','標準說明','textarea',row.notes||'',false]],onSubmit:data=>{Object.assign(row,{name:data.name,category:data.category,mode:data.mode,intervalKm:Number(data.intervalKm)||0,intervalMonths:Number(data.intervalMonths)||0,inspectKm:Number(data.inspectKm)||0,inspectMonths:Number(data.inspectMonths)||0,firstInspectAge:Number(data.firstInspectAge)||0,safety:data.safety,aliases:String(data.aliases||'').split(/[,，、\n]/).map(x=>x.trim()).filter(Boolean),applicability:data.applicability||'',notes:data.notes||''});closeModal();renderAll();toast(`${row.name}標準已更新`);}});
  }
  function partAssessmentReportHtml(vehicleId){
    const rows=partEvaluationForVehicle(vehicleId);const counts=rows.reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{});
    const summary=reportSummaryCards([['應優先處理',`${counts.due||0} 項`],['接近汰換',`${counts.soon||0} 項`],['建議檢查',`${counts.inspect||0} 項`],['正常',`${counts.normal||0} 項`],['缺少紀錄',`${counts.unknown||0} 項`]]);
    const table=reportTable(['零件／耗材','分類','標準週期','最近紀錄','已使用','檢查狀況','判斷','建議'],rows.map(x=>[esc(x.std.name),esc(x.std.category),esc(partStandardCycleText(x.std,x.effective)),esc(x.lastDate||x.lastKm!=null?`${x.lastDate||'日期未記錄'}${x.lastKm!=null?`／${num(x.lastKm)} km`:''}`:'無紀錄'),esc([x.kmSince!=null?`${num(x.kmSince)} km`:'',x.elapsedMonths!=null?`${num(x.elapsedMonths,1)}月`:''].filter(Boolean).join('／')||'-'),esc(conditionLabel(x.condition)),esc(x.meta.label),`${esc(x.reason)}<br>${esc(x.action)}`]));
    return `${summary}<div class="note warning">本表為維修篩檢工具；煞車、輪胎、底盤、冷卻與正時系統應以原廠手冊、零件規格及技師實際檢查為準。</div>${table}`;
  }

  function automationReasonLabel(reason){
    return ({startup:'系統啟動',timer:'定時檢查',focus:'重新開啟／取得焦點',manual:'手動執行',data:'資料變更',periodic:'背景檢查'}[reason]||reason||'自動檢查');
  }
  function automationSourceLabel(reminder){
    return ({obligation:'稅費／保險／驗車',maintenance:'維修工單','part-standard':'零件資料庫',manual:'手動提醒'}[reminder.sourceType]||(!reminder.sourceType?'手動提醒':reminder.sourceType));
  }
  function addAutomationLog(reason,alerts,detail=''){
    state.automationLog ||= [];
    const urgent=alerts.filter(x=>x.level==='urgent'||x.level==='overdue').length;
    const soon=alerts.filter(x=>x.level==='soon').length;
    state.automationLog.unshift({id:uid(),at:new Date().toISOString(),reason,alertCount:alerts.length,urgent,soon,detail});
    state.automationLog=state.automationLog.slice(0,AUTOMATION_LOG_LIMIT);
  }
  function partReminderTarget(row,vehicle){
    const settings=state.automationSettings||DEFAULT_AUTOMATION_SETTINGS;
    const baseDate=row.std.mode==='inspect'?(row.lastInspectDate||row.lastDate):(row.lastDate||row.lastInspectDate);
    const cycleMonths=row.std.mode==='inspect'?(row.std.inspectMonths||row.effective.months):(row.effective.months||row.std.inspectMonths);
    const cycleKm=row.std.mode==='inspect'?(row.std.inspectKm||row.effective.km):(row.effective.km||row.std.inspectKm);
    let targetDate=baseDate&&cycleMonths?addMonths(baseDate,cycleMonths):'';
    let targetKm=row.lastKm!=null&&cycleKm?Number(row.lastKm)+Number(cycleKm):null;
    if(row.status==='due'){targetDate=today();if(targetKm==null)targetKm=Number(vehicle.odometer)||null;}
    if(row.status==='inspect'&&!targetDate)targetDate=today();
    if(row.status==='soon'&&!targetDate)targetDate=addMonths(today(),1);
    if(row.status==='unknown'){
      // 待建立現況基準不沿用多年以前的舊週期期限，避免顯示成歷史逾期數千天。
      targetDate=addMonths(today(),Math.max(1,Math.round(Number(settings.leadDays||60)/30)));
      targetKm=null;
    }
    return {targetDate,targetKm};
  }
  function syncAutomaticPartReminders(data=state){
    data.reminders ||= [];
    for(const vehicle of data.vehicles||[]){
      const rows=partEvaluationForVehicle(vehicle.id);
      const activeKeys=new Set();
      for(const row of rows){
        const sourceId=`${vehicle.id}:${row.std.id}`;
        const existing=data.reminders.find(r=>r.sourceType==='part-standard'&&r.sourceId===sourceId);
        const shouldCreate=['due','soon','inspect'].includes(row.status)||(row.status==='unknown'&&['high','critical'].includes(row.std.safety));
        if(!shouldCreate){if(existing)existing.status='done';continue;}
        activeKeys.add(sourceId);
        const target=partReminderTarget(row,vehicle);
        const title=row.status==='due'?`${row.std.name}應優先處理`:row.status==='soon'?`${row.std.name}接近汰換`:row.status==='inspect'?`${row.std.name}建議檢查`:`${row.std.name}待建立基準檢查`;
        const reminder=existing||{id:uid(),vehicleId:vehicle.id};
        Object.assign(reminder,{vehicleId:vehicle.id,title,category:'零件',targetKm:target.targetKm,targetDate:target.targetDate||null,status:'active',notes:`自動評估：${row.reason}｜${row.action}`,sourceType:'part-standard',sourceId});
        if(!existing)data.reminders.push(reminder);
      }
      data.reminders.filter(r=>r.vehicleId===vehicle.id&&r.sourceType==='part-standard'&&!activeKeys.has(r.sourceId)).forEach(r=>r.status='done');
    }
  }
  function alertLevelForInfo(info){
    const settings=state.automationSettings||DEFAULT_AUTOMATION_SETTINGS;
    const overdue=(info.days!=null&&info.days<0)||(info.km!=null&&info.km<0);
    if(overdue)return 'overdue';
    if((info.days!=null&&info.days<=7)||(info.km!=null&&info.km<=500))return 'urgent';
    if((info.days!=null&&info.days<=Number(settings.leadDays||60))||(info.km!=null&&info.km<=Number(settings.leadKm||2000)))return 'soon';
    return 'later';
  }
  function collectAutomaticAlerts(){
    const alerts=[];
    for(const vehicle of state.vehicles||[]){
      for(const reminder of vrById(vehicle.id)){
        const info=reminderInfoForVehicle(vehicle.id,reminder);
        const level=alertLevelForInfo(info);
        alerts.push({key:`${vehicle.id}:${reminder.id}:${reminder.targetDate||''}:${reminder.targetKm||''}`,vehicleId:vehicle.id,vehicleName:vehicle.name,plate:vehicle.plate||'',reminder,info,level,source:automationSourceLabel(reminder),dueText:reminderRemainingText(info),rank:{overdue:0,urgent:1,soon:2,later:3}[level],categoryPriority:reminderCategoryPriority(reminder)});
      }
    }
    const backupDays=state.lastBackupAt?Math.floor((Date.now()-new Date(state.lastBackupAt).getTime())/86400000):null;
    if(backupDays==null||backupDays>=30){
      alerts.push({key:'system-backup',vehicleId:'',vehicleName:'系統資料',plate:'',reminder:{id:'system-backup',title:'完整JSON備份',category:'備份',targetDate:null,targetKm:null,sourceType:'backup'},info:null,level:backupDays==null?'soon':'later',source:'資料安全',dueText:backupDays==null?'尚未建立可還原備份':`距上次備份 ${backupDays} 天`,rank:backupDays==null?2:3,categoryPriority:3});
    }
    return alerts.sort((a,b)=>(a.categoryPriority??3)-(b.categoryPriority??3)||a.rank-b.rank||(a.info?.effectiveDays??999999)-(b.info?.effectiveDays??999999)||a.vehicleName.localeCompare(b.vehicleName,'zh-Hant'));
  }
  function automationLevelMeta(level){
    return ({overdue:{label:'已逾期',className:'red'},urgent:{label:'優先',className:'red'},soon:{label:'近期',className:'amber'},later:{label:'追蹤',className:'blue'}}[level]||{label:'追蹤',className:'blue'});
  }
  function renderAutomation(){
    const settings=state.automationSettings||DEFAULT_AUTOMATION_SETTINGS;
    const alerts=collectAutomaticAlerts();
    const urgent=alerts.filter(x=>['overdue','urgent'].includes(x.level)).length;
    const soon=alerts.filter(x=>x.level==='soon').length;
    const autoReminderCount=(state.reminders||[]).filter(r=>r.status!=='done'&&r.sourceType).length;
    const lastRun=settings.lastRunAt?new Date(settings.lastRunAt).toLocaleString('zh-TW',{hour12:false}):'尚未執行';
    $('#automationKpis').innerHTML=[['優先待辦',`${urgent} 項`,'#ff6d7b','已逾期或7天／500km內'],['近期提醒',`${soon} 項`,'#f2a62b',`依 ${settings.leadDays} 天／${num(settings.leadKm)} km 門檻`],['自動同步提醒',`${autoReminderCount} 項`,'#3dd6d0','來源包含工單、零件與法定事項'],['上次自動檢查',settings.lastRunAt?new Date(settings.lastRunAt).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'尚未執行','#2f8cff',automationReasonLabel(settings.lastRunReason)]].map(x=>`<div class="kpi-card" style="--accent:${x[2]}"><div class="kpi-top"><span>${x[0]}</span></div><div class="kpi-value">${x[1]}</div><div class="kpi-note">${x[3]}</div></div>`).join('');
    $('#autoEnabled').checked=!!settings.enabled;
    $('#autoPartReminders').checked=!!settings.autoPartReminders;
    $('#autoObligationReminders').checked=!!settings.autoObligationReminders;
    $('#autoBrowserNotifications').checked=!!settings.browserNotifications;
    $('#autoUpdateCheck').checked=!!settings.autoUpdateCheck;
    $('#autoCheckInterval').value=String(settings.intervalHours||6);
    $('#autoLeadDays').value=String(settings.leadDays||60);
    $('#autoLeadKm').value=String(settings.leadKm||2000);
    $('#automationAlertSummary').textContent=`共 ${alerts.length} 項｜優先 ${urgent}｜近期 ${soon}`;
    $('#automationAlertBody').innerHTML=alerts.map(x=>{const meta=automationLevelMeta(x.level);const target=x.reminder.targetDate||x.reminder.targetKm?`${x.reminder.targetDate||'—'}${x.reminder.targetKm?`／${num(x.reminder.targetKm)} km`:''}`:'—';const action=x.reminder.sourceType==='backup'?'<button class="action-btn" data-auto-jump="export">前往備份</button>':`<button class="action-btn" data-auto-vehicle="${x.vehicleId}" data-auto-jump="${x.reminder.sourceType==='obligation'?'obligations':x.reminder.sourceType==='part-standard'?'maintenance-evaluation':'reminders'}">查看</button>`;return `<tr><td data-label="優先度"><span class="badge ${meta.className}">${meta.label}</span></td><td data-label="車輛"><strong>${esc(x.vehicleName)}</strong>${x.plate?`<div class="muted">${esc(x.plate)}</div>`:''}</td><td data-label="提醒事項">${esc(x.reminder.title)}<div class="muted">${esc(x.reminder.notes||'')}</div></td><td data-label="期限">${esc(target)}</td><td data-label="剩餘狀態">${esc(x.dueText)}</td><td data-label="來源">${esc(x.source)}</td><td data-label="操作">${action}</td></tr>`;}).join('')||'<tr><td colspan="7" class="empty">目前沒有自動待辦</td></tr>';
    $('#automationLastRun').textContent=lastRun;
    $('#automationLog').innerHTML=(state.automationLog||[]).slice(0,20).map(log=>`<div class="automation-log-item"><span class="automation-log-dot"></span><div><strong>${esc(automationReasonLabel(log.reason))}</strong><small>${new Date(log.at).toLocaleString('zh-TW',{hour12:false})}｜待辦 ${log.alertCount||0}｜優先 ${log.urgent||0}${log.detail?`｜${esc(log.detail)}`:''}</small></div></div>`).join('')||'<div class="empty">尚未有自動運行紀錄</div>';
    const notificationStatus=!('Notification' in window)?'瀏覽器不支援':Notification.permission==='granted'?'已授權':Notification.permission==='denied'?'已封鎖':'尚未授權';
    const secure=window.isSecureContext?'HTTPS／安全環境':'非安全環境';
    const statusRows=[['網路狀態',pwaRuntime.network,navigator.onLine?'green':'amber'],['安全環境',secure,window.isSecureContext?'green':'amber'],['Service Worker',pwaRuntime.serviceWorker,pwaRuntime.serviceWorker.includes('正常')?'green':'blue'],['離線快取',pwaRuntime.offline,pwaRuntime.offline.includes('可用')?'green':'blue'],['背景定期檢查',pwaRuntime.periodic,pwaRuntime.periodic.includes('已登錄')?'green':'blue'],['瀏覽器通知',notificationStatus,('Notification' in window)&&Notification.permission==='granted'?'green':'amber'],['程式更新',pwaRuntime.update,pwaRuntime.update.includes('最新')?'green':'blue'],['安裝狀態',pwaRuntime.install,pwaRuntime.install.includes('已安裝')?'green':'blue']];
    $('#automationRuntimeStatus').innerHTML=statusRows.map(x=>`<div class="runtime-status-row"><span>${x[0]}</span><strong><i class="runtime-dot ${x[2]}"></i>${esc(x[1])}</strong></div>`).join('');
  }
  function saveAutomationSettingsFromUi(){
    const s=state.automationSettings||=structuredClone(DEFAULT_AUTOMATION_SETTINGS);
    Object.assign(s,{enabled:$('#autoEnabled').checked,autoPartReminders:$('#autoPartReminders').checked,autoObligationReminders:$('#autoObligationReminders').checked,browserNotifications:$('#autoBrowserNotifications').checked,autoUpdateCheck:$('#autoUpdateCheck').checked,intervalHours:Number($('#autoCheckInterval').value)||6,leadDays:Number($('#autoLeadDays').value)||60,leadKm:Number($('#autoLeadKm').value)||2000});
    save();scheduleAutomation();renderAutomation();
  }
  function openAutomationDb(){
    return new Promise((resolve,reject)=>{if(!('indexedDB' in window))return reject(new Error('IndexedDB unavailable'));const req=indexedDB.open('VehicleHubAutomation',1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('state'))db.createObjectStore('state',{keyPath:'key'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  }
  async function persistAutomationSnapshot(alerts){
    try{const db=await openAutomationDb();await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put({key:'snapshot',savedAt:new Date().toISOString(),enabled:!!state.automationSettings.enabled,notifications:!!state.automationSettings.browserNotifications,alerts:alerts.filter(x=>x.reminder.sourceType!=='backup').map(x=>({key:x.key,title:x.reminder.title,vehicleName:x.vehicleName,targetDate:x.reminder.targetDate||'',remainingKm:x.info?.km??null,level:x.level,dueText:x.dueText}))});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}catch(err){console.debug('自動提醒快照無法保存',err);}
  }
  async function showAutomaticNotifications(alerts){
    const settings=state.automationSettings||DEFAULT_AUTOMATION_SETTINGS;
    if(!settings.browserNotifications||!('Notification' in window)||Notification.permission!=='granted')return 0;
    const candidates=alerts.filter(x=>['overdue','urgent','soon'].includes(x.level)&&x.reminder.sourceType!=='backup');
    const dateKey=today();const unsent=candidates.filter(x=>state.notificationHistory[x.key]!==dateKey);
    if(!unsent.length)return 0;
    const shown=unsent.slice(0,8);const body=shown.slice(0,4).map(x=>`${x.vehicleName}｜${x.reminder.title}｜${x.dueText}`).join('\n')+(shown.length>4?`\n另有 ${shown.length-4} 項`:``);
    try{
      const options={body,tag:`vehicle-hub-${dateKey}`,renotify:false,icon:'./icon.svg',badge:'./icon.svg',data:{url:'./index.html#automation'}};
      const reg=pwaRegistration||await navigator.serviceWorker?.ready;
      if(reg?.showNotification)await reg.showNotification(`車輛提醒：${shown.length} 項待處理`,options);else new Notification(`車輛提醒：${shown.length} 項待處理`,options);
      shown.forEach(x=>state.notificationHistory[x.key]=dateKey);settings.lastNotificationAt=new Date().toISOString();save();return shown.length;
    }catch(err){console.warn('通知顯示失敗',err);return 0;}
  }
  async function runAutomaticAssessment({force=false,notify=true,reason='manual',silent=false}={}){
    if(automationRunning)return;
    const settings=state.automationSettings||DEFAULT_AUTOMATION_SETTINGS;
    if(!settings.enabled&&!force)return;
    automationRunning=true;
    try{
      if(settings.autoObligationReminders){ensureAnnualVehicleObligations(state);ensureVehicleMasterDueItems(state);syncAllObligationReminders(state);}
      if(settings.autoPartReminders)syncAutomaticPartReminders(state);
      const alerts=collectAutomaticAlerts();
      settings.lastRunAt=new Date().toISOString();settings.lastRunReason=reason;
      addAutomationLog(reason,alerts,`車輛 ${state.vehicles.length} 台`);
      renderAll();
      await persistAutomationSnapshot(alerts);
      const notified=notify?await showAutomaticNotifications(alerts):0;
      if(notified){addAutomationLog('periodic',alerts,`已送出 ${notified} 項系統通知`);save();renderAutomation();}
      if(!silent)toast(`自動評估完成：${alerts.length} 項待辦`);
    }catch(err){console.error('自動評估失敗',err);addAutomationLog(reason,[],'執行失敗');save();if(!silent)toast('自動評估執行失敗','error');}
    finally{automationRunning=false;scheduleAutomation();}
  }
  function scheduleAutomation(){
    if(automationTimer)clearInterval(automationTimer);
    const settings=state.automationSettings||DEFAULT_AUTOMATION_SETTINGS;
    if(!settings.enabled)return;
    automationTimer=setInterval(()=>runAutomaticAssessment({reason:'timer',notify:true,silent:true}),Math.max(1,Number(settings.intervalHours)||6)*3600000);
  }
  async function requestNotificationPermission(){
    if(!('Notification' in window)){toast('此瀏覽器不支援系統通知','error');return;}
    if(!window.isSecureContext){toast('系統通知需要 HTTPS；請部署到 GitHub Pages 後再啟用','error');return;}
    try{const permission=await Notification.requestPermission();state.automationSettings.browserNotifications=permission==='granted';save();renderAutomation();if(permission==='granted'){toast('系統通知已啟用');await registerPeriodicSync();await runAutomaticAssessment({force:true,notify:true,reason:'manual',silent:true});}else toast('通知權限未授權','error');}catch(err){toast('無法取得通知權限','error');}
  }
  function showUpdateBanner(message='偵測到新版本，重新載入即可套用。'){$('#appUpdateText').textContent=message;$('#appUpdateBanner').hidden=false;pwaRuntime.update='有新版本可用';renderAutomation();}
  async function checkForAppUpdate(manual=false){
    if(!state.automationSettings?.autoUpdateCheck&&!manual)return;
    if(location.protocol==='file:'){pwaRuntime.update='本機檔案模式無法自動更新';renderAutomation();if(manual)toast('請部署到 GitHub Pages 後使用自動更新');return;}
    try{const res=await fetch(`./version.json?t=${Date.now()}`,{cache:'no-store'});if(!res.ok)throw new Error('version unavailable');const info=await res.json();if(info.version&&info.version!==APP_VERSION)showUpdateBanner(`目前 V${APP_VERSION}，最新 V${info.version}。`);else{pwaRuntime.update=`已是最新 V${APP_VERSION}`;if(manual)toast('目前已是最新版本');}if(pwaRegistration)await pwaRegistration.update();renderAutomation();}catch(err){pwaRuntime.update='更新檢查暫時失敗';renderAutomation();if(manual)toast('目前無法檢查更新','error');}
  }
  async function registerPeriodicSync(){
    try{const reg=pwaRegistration||await navigator.serviceWorker.ready;if(reg&&'periodicSync' in reg){await reg.periodicSync.register('vehicle-reminder-check',{minInterval:24*60*60*1000});state.automationSettings.periodicSyncRegistered=true;pwaRuntime.periodic='已登錄每日背景檢查';save();}else pwaRuntime.periodic='瀏覽器不支援，改為開啟時檢查';}catch(err){pwaRuntime.periodic='未獲准，改為開啟時檢查';}renderAutomation();
  }
  async function initPwa(){
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;pwaRuntime.install='可以安裝到裝置';$('#installPwaButton').hidden=false;renderAutomation();});
    window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;pwaRuntime.install='已安裝成應用程式';$('#installPwaButton').hidden=true;renderAutomation();});
    const standalone=window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone;if(standalone)pwaRuntime.install='已安裝／獨立視窗運行';
    if(!('serviceWorker' in navigator)||location.protocol==='file:'){pwaRuntime.serviceWorker=location.protocol==='file:'?'本機檔案模式不啟用':'瀏覽器不支援';pwaRuntime.offline='需 GitHub Pages／HTTPS';pwaRuntime.periodic='需 GitHub Pages／HTTPS';renderAutomation();return;}
    try{
      pwaRegistration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});pwaRuntime.serviceWorker='已正常登錄';pwaRuntime.offline='離線快取可用';
      if(pwaRegistration.waiting)showUpdateBanner();
      pwaRegistration.addEventListener('updatefound',()=>{const worker=pwaRegistration.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)showUpdateBanner();});});
      navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updateReloading)return;updateReloading=true;location.reload();});
      await registerPeriodicSync();
      if(state.automationSettings.autoUpdateCheck)setTimeout(()=>checkForAppUpdate(false),1500);
    }catch(err){pwaRuntime.serviceWorker='登錄失敗';pwaRuntime.offline='無法啟用';pwaRuntime.periodic='無法啟用';console.warn(err);}
    renderAutomation();
  }
  async function installPwa(){if(!deferredInstallPrompt){toast('目前沒有可用的安裝提示；可使用瀏覽器選單「安裝應用程式」');return;}await deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$('#installPwaButton').hidden=true;}

  const FUEL_QUALITY_META={
    confirmed:{label:'已確認',className:'confirmed'},
    estimated:{label:'估算資料',className:'estimated'},
    inferred:{label:'回推資料',className:'inferred'},
    review:{label:'待人工確認',className:'review'}
  };
  function fuelQualityMeta(row){return FUEL_QUALITY_META[row?.dataQualityStatus]||FUEL_QUALITY_META.confirmed;}
  function directFuelEfficiency(row){if(row?.fullTank!==true)return null;const d=Number(row?.distanceProvided)||0,l=Number(row?.liters)||0;return d>0&&l>0?d/l:null;}
  function fuelQualityIssues(row){
    const issues=[];const direct=directFuelEfficiency(row);const benchmark=Number(vehicleById(row.vehicleId)?.benchmarkEfficiency)||null;
    if(row.dataQualityStatus==='review')issues.push({type:'fullTank',level:'high',title:'是否加滿待確認',detail:row.notes||'此筆暫不納入油耗平均。'});
    if(row.fullTank===false)issues.push({type:'fullTank',level:'low',title:'已確認部分加油／未加滿',detail:'本筆油量會累計至下一個真正加滿週期，不單獨計算油耗。'});
    if(!hasPositiveNumber(row.odometer))issues.push({type:'odometer',level:'high',title:'缺少里程',detail:'無法形成獨立油耗週期。'});
    else if(row.odometerEstimated)issues.push({type:'odometer',level:'medium',title:'里程為估算值',detail:row.odometerEstimateMethod||'估算方法未填。'});
    if(row.dateYearInferred&&!row.userConfirmed)issues.push({type:'year',level:'low',title:'年份依順序回推',detail:'可人工確認後保留為已確認年份。'});
    if(row.fullTank===null&&row.dataQualityStatus!=='review')issues.push({type:'fullTank',level:'medium',title:'是否加滿未確認',detail:'不會作為加滿週期終點。'});
    if(row.fullTankEstimated&&!row.userConfirmed)issues.push({type:'fullTank',level:'low',title:'加滿狀態為推定',detail:'可人工確認是否確實加滿。'});
    if(row.litersEstimated||row.unitPriceEstimated)issues.push({type:'estimate',level:'low',title:'油量／單價含估算',detail:row.priceSource||'依現有資料推估。'});
    if(direct&&benchmark&&direct>benchmark*1.4)issues.push({type:'outlier',level:'high',title:`區間油耗 ${num(direct,2)} km/L 偏高`,detail:`高於車輛參考值 ${num(benchmark,1)} km/L 約 ${num((direct/benchmark-1)*100,0)}%。`});
    if(direct&&benchmark&&direct<benchmark*.55)issues.push({type:'outlier',level:'high',title:`區間油耗 ${num(direct,2)} km/L 偏低`,detail:'請檢查里程、油量或是否中途加油。'});
    return issues;
  }
  function fuelQualityRows(vehicleId=state.activeVehicleId){
    return vfById(vehicleId).slice().reverse().map(row=>({row,issues:fuelQualityIssues(row)}));
  }
  function renderFuelQuality(){
    const all=fuelQualityRows();const status=$('#fuelQualityStatusFilter').value||'';const issue=$('#fuelQualityIssueFilter').value||'';const keyword=($('#fuelQualityKeyword').value||'').trim().toLowerCase();
    const review=all.filter(x=>x.row.dataQualityStatus==='review').length;const estimated=all.filter(x=>x.row.dataQualityStatus==='estimated').length;const inferred=all.filter(x=>x.row.dataQualityStatus==='inferred').length;const confirmed=all.filter(x=>x.row.dataQualityStatus==='confirmed'||x.row.userConfirmed).length;
    $('#fuelQualityKpis').innerHTML=[
      ['待人工確認',`${review} 筆`,'不納入有效油耗平均','#ff6d7b'],
      ['估算資料',`${estimated} 筆`,'保留估算方法與標籤','#f2a62b'],
      ['年份／加滿回推',`${inferred} 筆`,'可逐筆人工確認','#2f8cff'],
      ['已確認資料',`${confirmed} 筆`,'可作為主要分析依據','#49c96b']
    ].map(([label,value,note,color])=>`<article class="kpi-card" style="--accent:${color}"><div class="kpi-top"><span class="kpi-icon">✓</span>${label}</div><div class="kpi-value">${value}</div><div class="kpi-note">${note}</div></article>`).join('');
    const quality=review?'有待確認資料':estimated||inferred?'可分析但含推估':'資料完整';
    $('#fuelQualityOverallChip').textContent=quality;$('#fuelQualityOverallChip').className=`data-quality-chip ${review?'warn':estimated||inferred?'normal':'good'}`;
    $('#fuelQualitySummary').textContent=`目前車輛共有 ${all.length} 筆加油紀錄；分析模式：${state.fuelAnalysisMode==='confirmed'?'僅已確認資料':'含估算／回推資料，但排除待確認資料'}。`;
    $('#fuelAnalysisDataMode').value=state.fuelAnalysisMode||'all';
    const rows=all.filter(x=>(!status||x.row.dataQualityStatus===status||status==='confirmed'&&x.row.userConfirmed)&&(!issue||x.issues.some(i=>i.type===issue))&&(!keyword||`${x.row.date} ${x.row.notes} ${x.row.odometerEstimateMethod} ${x.row.priceSource}`.toLowerCase().includes(keyword)));
    $('#fuelQualityCount').textContent=`顯示 ${rows.length}／${all.length} 筆`;
    $('#fuelQualityBody').innerHTML=rows.map(({row,issues})=>{const meta=fuelQualityMeta(row);const issueHtml=issues.length?issues.map(i=>`<div class="quality-reason"><strong>${esc(i.title)}</strong><small>${esc(i.detail)}</small></div>`).join(''):'<span class="badge green">未發現明顯問題</span>';const actions=[];if(row.dataQualityStatus==='review'){actions.push(`<button class="action-btn" data-quality-full="${row.id}">確認為加滿</button>`,`<button class="action-btn" data-quality-notfull="${row.id}">確認非加滿</button>`);}if(row.odometerEstimated||row.dateYearInferred||row.fullTankEstimated||row.dataQualityStatus==='estimated'||row.dataQualityStatus==='inferred')actions.push(`<button class="action-btn" data-quality-confirm="${row.id}">人工確認</button>`);actions.push(`<button class="action-btn" data-edit-fuel="${row.id}">編輯</button>`);return `<tr><td data-label="日期"><strong>${esc(row.date)}</strong>${row.dateYearInferred?'<div class="muted">年份回推</div>':''}</td><td data-label="里程">${fuelOdometerText(row.odometer,row.odometerEstimated)}</td><td data-label="公升／金額">${fuelLitersText(row.liters,2,row.litersEstimated)}<div class="muted">${money(row.amount)}</div></td><td data-label="資料狀態"><span class="quality-status ${meta.className}">${meta.label}</span>${row.userConfirmed?'<div class="muted">已人工確認</div>':''}</td><td data-label="檢查結果">${issueHtml}</td><td data-label="估算／判斷依據"><div class="quality-reason"><small>${esc(row.odometerEstimateMethod||row.priceSource||row.notes||'—')}</small></div></td><td data-label="操作"><div class="quality-actions">${actions.join('')}</div></td></tr>`;}).join('')||'<tr><td colspan="7" class="empty">沒有符合條件的資料</td></tr>';
    const unclassified=(state.unclassifiedRecords||[]).filter(x=>!x.vehicleId||x.vehicleId===state.activeVehicleId);
    $('#unclassifiedRecordBody').innerHTML=unclassified.map(x=>`<tr><td>${esc(x.vehicleId?vehicleById(x.vehicleId).name:'未指定')}</td><td>${esc(x.type)}</td><td><span class="unclassified-value">${esc(x.value)}</span></td><td>${esc(x.date||'未提供')}</td><td><span class="quality-status review">${esc(x.status)}</span></td><td>${esc(x.notes)}</td><td><button class="action-btn" data-unclassified-resolve="${x.id}">標記已處理</button></td></tr>`).join('')||'<tr><td colspan="7" class="empty">目前沒有未歸類資料</td></tr>';
  }
  function fuelQualityCsvRows(){
    const v=activeVehicle();return [['車輛',v.name],['車牌',v.plate||''],['分析模式',state.fuelAnalysisMode==='confirmed'?'僅已確認資料':'含估算／回推資料'],[],['日期','里程','公升','實付金額','資料狀態','人工確認','問題','估算／判斷依據'],...fuelQualityRows().map(({row,issues})=>[row.date,row.odometer??'',row.liters??'',row.amount||0,fuelQualityMeta(row).label,row.userConfirmed?'是':'否',issues.map(x=>x.title).join('；'),row.odometerEstimateMethod||row.priceSource||row.notes||''])];
  }
  function exportFuelQualityCsvFile(){const v=activeVehicle();download(`加油資料品質_${v.name}_${today()}.csv`,csv(fuelQualityCsvRows()),'text/csv;charset=utf-8');}
  function icsEscape(value){return String(value??'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');}
  function dateToIcs(date){return String(date||'').replaceAll('-','');}
  function buildReminderCalendarIcs(){
    const events=[];const seen=new Set();
    for(const r of state.reminders||[]){if(r.status==='done'||!r.targetDate)continue;const key=`r-${r.id}-${r.targetDate}`;if(seen.has(key))continue;seen.add(key);events.push({uid:`${key}@vehicle-hub`,date:r.targetDate,title:`${vehicleById(r.vehicleId).name}｜${r.title}`,description:[r.category,r.notes].filter(Boolean).join('｜')});}
    for(const o of state.obligations||[]){if(!['待繳','待確認'].includes(o.status)||!o.dueDate)continue;const key=`o-${o.id}-${o.dueDate}`;if(seen.has(key))continue;seen.add(key);events.push({uid:`${key}@vehicle-hub`,date:o.dueDate,title:`${vehicleById(o.vehicleId).name}｜${o.type}${o.status==='待確認'?'狀態待確認':'到期'}`,description:[o.provider,o.notes,o.amount?`金額 ${o.amount} 元`:null].filter(Boolean).join('｜')});}
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Vehicle Hub//V5.6.6//ZH-TW','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:車輛保養與到期提醒'];
    events.forEach(e=>{lines.push('BEGIN:VEVENT',`UID:${icsEscape(e.uid)}`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')}`,`DTSTART;VALUE=DATE:${dateToIcs(e.date)}`,`SUMMARY:${icsEscape(e.title)}`,`DESCRIPTION:${icsEscape(e.description)}`);[90,30,7].forEach(d=>lines.push('BEGIN:VALARM',`TRIGGER:-P${d}D`,'ACTION:DISPLAY',`DESCRIPTION:${icsEscape(e.title)}（提前${d}天）`,'END:VALARM'));lines.push('END:VEVENT');});
    lines.push('END:VCALENDAR');return lines.join('\r\n');
  }
  function exportCalendarIcsFile(){download(`車輛提醒行事曆_${today()}.ics`,buildReminderCalendarIcs(),'text/calendar;charset=utf-8');}
  function downloadLatestSnapshotFile(){const snap=latestLocalSnapshot();if(!snap){toast('目前沒有本機快照','error');return;}download(`車輛系統快照_${snap.createdAt.slice(0,10)}_${snap.id}.json`,JSON.stringify(snap,null,2),'application/json');}
  function restoreLatestSnapshotData(){const snap=latestLocalSnapshot();if(!snap){toast('目前沒有可還原的本機快照','error');return;}if(!confirm(`確定還原 ${new Date(snap.createdAt).toLocaleString('zh-TW')} 的快照？目前資料會先建立保護快照。`))return;createLocalSnapshot('還原前保護快照');state=migrateData(snap.data);renderAll();toast('已還原最近本機快照');}

  function renderAll(){
    if(state.automationSettings?.enabled){
      if(state.automationSettings.autoObligationReminders){ensureAnnualVehicleObligations(state);ensureVehicleMasterDueItems(state);syncAllObligationReminders(state);}
      if(state.automationSettings.autoPartReminders)syncAutomaticPartReminders(state);
    }
    renderVehicleSelect();
    renderVehicleManagement();
    renderDashboard();
    renderMaintenance();
    renderMaintenanceEvaluation();
    renderPartAssessment();
    renderFuel();
    renderFuelQuality();
    renderEfficiency();
    renderAnalysis();
    renderAutomation();
    renderReminders();
    renderServiceShopList();
    renderObligations();
    renderVehicleForm();
    renderMileageHistory();
    setQuickDefaults();
    save();
  }

  function renderVehicleSelect(){
    const select = $('#vehicleSelect');
    select.innerHTML = state.vehicles.map(v=>`<option value="${v.id}" ${v.id===state.activeVehicleId?'selected':''}>${esc(v.name)}${v.plate?`｜${esc(v.plate)}`:''}</option>`).join('');
  }

  function renderVehicleManagement(){
    const wrap = $('#vehicleCards');
    if(!wrap) return;
    wrap.innerHTML = state.vehicles.map(v=>{
      const fuelCount = state.fuel.filter(x=>x.vehicleId===v.id).length;
      const maintCount = state.maintenance.filter(x=>x.vehicleId===v.id).length;
      const reminderCount = state.reminders.filter(x=>x.vehicleId===v.id && x.status!=='done').length;
      return `<button class="vehicle-card ${v.id===state.activeVehicleId?'active':''}" data-select-vehicle="${v.id}" type="button">
        <div class="vehicle-card-head">
          <div>
            <strong>${esc(v.name)}</strong>
            <small>${esc(v.plate || '未填車牌')}</small>
          </div>
          <span class="badge ${v.id===state.activeVehicleId?'green':'blue'}">${v.id===state.activeVehicleId?'目前查看':'切換'}</span>
        </div>
        ${v.isDemo?'<div class="demo-data-label">示範資料，請依實車修改車牌、年份與費用</div>':''}
        <div class="vehicle-card-meta"><span>${v.year || '—'} 年</span><span>${esc(v.fuelType || '未設定油品')}</span><span>${esc(v.usage || '未設定用途')}</span></div>
        <div class="vehicle-card-stats">
          <div><small>目前里程</small><b>${num(v.odometer)} km</b></div>
          <div><small>加油筆數</small><b>${num(fuelCount)} 筆</b></div>
          <div><small>保養筆數</small><b>${num(maintCount)} 筆</b></div>
          <div><small>提醒數</small><b>${num(reminderCount)} 項</b></div>
        </div>
      </button>`;
    }).join('') || `<div class="empty">尚未建立車輛</div>`;
  }

  function renderFleetOverview(){
    const list = state.vehicles.map(v=>({vehicle:v, metrics:metricsForVehicle(v.id), reminder:nextReminderTextForVehicle(v.id)}));
    const totalFuelYear = list.reduce((s,x)=>s+x.metrics.fuelYear,0);
    const totalMaintYear = list.reduce((s,x)=>s+x.metrics.maintYear,0);
    const totalFuelMonth = list.reduce((s,x)=>s+x.metrics.fuelMonth,0);
    const allCycles=list.flatMap(x=>x.metrics.valid).filter(x=>x.distance>0&&x.cycleLiters>0);
    const fleetDistance=allCycles.reduce((s,x)=>s+Number(x.distance||0),0);
    const fleetLiters=allCycles.reduce((s,x)=>s+Number(x.cycleLiters||0),0);
    const fleetFuelCost=allCycles.reduce((s,x)=>s+Number(x.cycleAmount||0),0);
    const avgEff = fleetLiters>0?fleetDistance/fleetLiters:0;
    const avgCostKm = fleetDistance>0?fleetFuelCost/fleetDistance:0;
    $('#fleetKpis').innerHTML = [
      ['車輛總數',`${num(state.vehicles.length)} 台`,`已建立並可切換查看`],
      ['本月總加油金額',money(totalFuelMonth),`全部車輛本月累計`],
      ['本年度總燃油支出',money(totalFuelYear),`全部車輛年度合計`],
      ['本年度總維修費',money(totalMaintYear),`全部車輛年度合計`],
      ['全車平均油耗',`${num(avgEff,1)} km/L`,`平均每公里油費 ${money2(avgCostKm)}/km`]
    ].map(x=>`<div class="fleet-kpi"><small>${x[0]}</small><strong>${x[1]}</strong><span>${x[2]}</span></div>`).join('');
    $('#fleetVehicleCards').innerHTML = list.map(({vehicle, metrics, reminder})=>`<button class="vehicle-compare-card ${vehicle.id===state.activeVehicleId?'active':''}" data-select-vehicle="${vehicle.id}" type="button"><div class="top"><div><strong>${esc(vehicle.name)}</strong><small>${esc(vehicle.plate || '未填車牌')}</small></div><span class="badge ${vehicle.id===state.activeVehicleId?'green':'blue'}">${vehicle.id===state.activeVehicleId?'目前查看':'切換查看'}</span></div>${vehicle.isDemo?'<div class="demo-data-label">示範資料</div>':''}<div class="meta"><span>${vehicle.year || '—'} 年</span><span>${esc(vehicle.fuelType || '未設定油品')}</span><span>${esc(vehicle.usage || '未設定用途')}</span></div><div class="stats"><div><label>目前里程</label><b>${num(vehicle.odometer)} km</b></div><div><label>最近油耗</label><b>${metrics.latestEff?`${num(metrics.latestEff,1)} km/L`:'—'}</b></div><div><label>本月油費</label><b>${money(metrics.fuelMonth)}</b></div><div><label>年度維修</label><b>${money(metrics.maintYear)}</b></div></div><div class="foot"><span class="hint">${esc(reminder)}</span><span class="link-btn">切換 ›</span></div></button>`).join('');
    $('#fleetTableBody').innerHTML = list.map(({vehicle, metrics, reminder})=>`<tr><td>${esc(vehicle.name)}<div class="muted">${esc(vehicle.plate || '')}</div></td><td>${num(vehicle.odometer)} km</td><td>${metrics.latestEff?`${num(metrics.latestEff,2)} km/L`:'—'}</td><td>${money(metrics.fuelMonth)}</td><td>${money(metrics.maintYear)}</td><td>${metrics.fuelCostKm?`${money2(metrics.fuelCostKm)}/km`:'—'}</td><td>${esc(reminder)}</td><td><button class="action-btn" data-select-vehicle="${vehicle.id}">切換</button></td></tr>`).join('') || `<tr><td colspan="8" class="empty">尚未建立車輛</td></tr>`;
    const dueItems=(state.obligations||[]).filter(x=>['待繳','待確認'].includes(x.status)).sort((a,b)=>(a.dueDate||'9999-12-31').localeCompare(b.dueDate||'9999-12-31')).slice(0,6);
    $('#fleetDueList').innerHTML=dueItems.map(x=>{const v=vehicleById(x.vehicleId);const days=daysUntil(x.dueDate);const cls=days!=null&&days<0?'overdue':days!=null&&days>60?'ok':'';const status=days==null?'未設定日期':days<0?`逾期 ${Math.abs(days)} 天`:days===0?'今天到期':`剩餘 ${days} 天`;return `<button class="fleet-due-item ${cls}" data-select-vehicle="${x.vehicleId}" data-jump="obligations" type="button"><strong>${esc(v.name)}｜${esc(x.type)}</strong><small>${esc(x.provider||'未填承辦單位')}　${money(x.amount)}</small><div class="due-meta"><span>${x.dueDate||'未設定到期日'}</span><span class="due-status">${status}</span></div></button>`;}).join('')||`<div class="empty">目前沒有待繳或即將到期事項</div>`;
  }

  function renderDashboard(){
    const m = metrics();
    const cards = [
      ['◉','目前總里程',`${num(m.vehicle.odometer)} km`,'#2f8cff','依最近一筆紀錄更新'],
      ['◒',m.latestEffEstimated?'最近一次推估油耗':'最近一次實際油耗',m.latestEff?`${num(m.latestEff,1)} km/L`:'資料不足','#3dd6d0',m.latestEffEstimated?'依推定加滿與估算里程計算':'採加滿到加滿法'],
      ['⛽','本月加油金額',money(m.fuelMonth),'#f2a62b','本月實付累計'],
      ['🛠','本年度維修保養費',money(m.maintYear),'#8b65ff','不含燃油'],
      ['$','每公里燃油成本',m.fuelCostKm?`${money2(m.fuelCostKm)}/km`:'資料不足','#49c96b','近三次有效加滿週期加權'],
      ['▣','下次提醒',m.nextReminder?`<span class="kpi-reminder-title">${esc(m.nextReminder.reminder.title)}</span><span class="kpi-reminder-value">${esc(reminderRemainingText(m.nextReminder))}</span>`:'尚未設定','#d8aa16','公里與日期先到者優先']
    ];
    $('#kpiGrid').innerHTML = cards.map(c=>`<article class="kpi-card" style="--accent:${c[3]}"><div class="kpi-top"><span class="kpi-icon">${c[0]}</span><span>${c[1]}</span></div><div class="kpi-value">${c[2]}</div><div class="kpi-foot"><i></i></div><div class="kpi-note">${c[4]}</div></article>`).join('');
    renderFleetOverview();
    renderTrendChart();
    renderRecentTables();
    renderDonut();
    renderDashboardReminders();
    renderMonthlySummary();
  }

  function renderTrendChart(){
    const svg = $('#trendChart');
    const fuelRows = computeFuelRowsForVehicle(state.activeVehicleId);
    const months=[];
    const now = new Date();
    for(let i=trendMonths-1;i>=0;i--){ const d=new Date(now.getFullYear(),now.getMonth()-i,1); months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); }
    const data=months.map(key=>{
      const rows=fuelRows.filter(x=>monthKey(x.date)===key);
      const valid=rows.filter(x=>x.efficiency);
      const cost=rows.reduce((s,x)=>s+Number(x.amount||0),0);
      const knownOdo=rows.filter(x=>hasPositiveNumber(x.odometer)).map(x=>Number(x.odometer));
      const dist=knownOdo.length>1?Math.max(...knownOdo)-Math.min(...knownOdo):(valid.reduce((s,x)=>s+Number(x.distance||0),0));
      const validDistance=valid.reduce((s,x)=>s+Number(x.distance||0),0);
      const validLiters=valid.reduce((s,x)=>s+Number(x.cycleLiters||0),0);
      const eff=validLiters>0?validDistance/validLiters:0;
      return {key,label:`${Number(key.slice(5))}月`,fullLabel:`${key.slice(0,4)}年${Number(key.slice(5))}月`,cost,dist,eff,count:rows.length,validCount:valid.length};
    });
    const W=1000,H=360,p={l:58,r:72,t:22,b:46}; const iw=W-p.l-p.r,ih=H-p.t-p.b;
    const maxCost=Math.max(3000,...data.map(x=>x.cost))*1.18; const maxDist=Math.max(600,...data.map(x=>x.dist))*1.18; const maxEff=Math.max(16,...data.map(x=>x.eff))*1.05;
    const x=i=>p.l+(data.length===1?iw/2:i*iw/(data.length-1));
    const yEff=v=>p.t+ih-(v/maxEff)*ih; const yCost=v=>p.t+ih-(v/maxCost)*ih; const yDist=v=>p.t+ih-(v/maxDist)*ih;
    let out='';
    for(let i=0;i<=4;i++){const y=p.t+ih*i/4;out+=`<line class="chart-grid" x1="${p.l}" y1="${y}" x2="${W-p.r}" y2="${y}"/><text class="chart-label" x="${p.l-12}" y="${y+4}" text-anchor="end">${num(maxEff*(4-i)/4,0)}</text><text class="chart-label" x="${W-p.r+12}" y="${y+4}">${num(maxCost*(4-i)/4,0)}</text>`;}
    out+=`<line class="chart-axis" x1="${p.l}" y1="${p.t+ih}" x2="${W-p.r}" y2="${p.t+ih}"/>`;
    const barW=Math.max(7,Math.min(28,iw/data.length*.35));
    data.forEach((d,i)=>{const xx=x(i);const cy=yCost(d.cost);out+=`<rect x="${xx-barW/2}" y="${cy}" width="${barW}" height="${p.t+ih-cy}" rx="5" fill="url(#barGrad)" opacity=".88"/><text class="chart-label" x="${xx}" y="${H-18}" text-anchor="middle">${d.label}</text>`;});
    const effPts=data.map((d,i)=>`${x(i)},${yEff(d.eff)}`).join(' '); const distPts=data.map((d,i)=>`${x(i)},${yDist(d.dist)}`).join(' ');
    out=`<defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b92ff"/><stop offset="1" stop-color="#1456a6"/></linearGradient></defs>`+out;
    out+=`<polyline points="${effPts}" class="chart-line" stroke="#3dd6d0"/><polyline points="${distPts}" class="chart-line" stroke="#f2a62b" stroke-width="3"/>`;
    data.forEach((d,i)=>{out+=`<circle class="chart-point" cx="${x(i)}" cy="${yEff(d.eff)}" r="5" fill="#3dd6d0"/><circle class="chart-point" cx="${x(i)}" cy="${yDist(d.dist)}" r="4" fill="#f2a62b"/>`;});
    data.forEach((d,i)=>{const left=i===0?p.l:(x(i-1)+x(i))/2;const right=i===data.length-1?W-p.r:(x(i)+x(i+1))/2;out+=`<rect class="chart-hover-zone" data-chart-index="${i}" x="${left}" y="${p.t}" width="${Math.max(1,right-left)}" height="${ih}" fill="transparent"/>`;});
    svg.innerHTML=out;
    bindChartTooltip(svg,data,d=>`<strong>${esc(d.fullLabel)}</strong><div><span>加油費用</span><b>${money(d.cost)}</b></div><div><span>行駛里程</span><b>${d.dist?`${num(d.dist)} km`:'無有效里程'}</b></div><div><span>平均油耗</span><b>${d.eff?`${num(d.eff,2)} km/L`:'無有效油耗'}</b></div><small>加油 ${d.count} 筆｜有效油耗週期 ${d.validCount} 筆</small>`);
  }

  function renderRecentTables(){
    $('#recentMaintenanceBody').innerHTML = vm().slice(0,3).map(x=>`<tr><td>${x.date.replaceAll('-','/')}</td><td>${maintenanceOdometerText(x.odometer)}</td><td title="${esc(x.items)}">${esc(x.items)}</td><td>${money(x.total)}</td><td>${x.nextKm?`<span class="badge amber">${num(x.nextKm)} km</span>`:x.nextDate?`<span class="badge blue">${x.nextDate.slice(0,7).replace('-','/')}</span>`:'<span class="muted">視情況</span>'}</td></tr>`).join('') || `<tr><td colspan="5" class="empty">尚無資料</td></tr>`;
    const rows=computeFuelRowsForVehicle(state.activeVehicleId).slice(-3).reverse();
    $('#recentFuelBody').innerHTML=rows.map(x=>`<tr><td>${x.date.replaceAll('-','/')}</td><td>${esc(x.fuelType)}</td><td>${fuelLitersText(x.liters,1,x.litersEstimated)}</td><td>${fuelUnitPriceText(x.unitPrice,1,x.unitPriceEstimated)}</td><td>${fuelAmountText(x)}</td><td><span class="badge ${fullTankBadge(x.fullTank,x.fullTankEstimated)}">${fullTankText(x.fullTank,x.fullTankEstimated)}</span></td><td>${x.efficiency?`<span style="color:#56e2d8">${num(x.efficiency,1)} km/L${x.efficiencyEstimated?' <span class="estimated-mark">估算</span>':''}</span>`:`<span class="muted">${x.fullTank===null?'未確認加滿':'累計中'}</span>`}</td></tr>`).join('') || `<tr><td colspan="7" class="empty">尚無資料</td></tr>`;
  }

  function obligationYearTotal(vehicleId=state.activeVehicleId, year=today().slice(0,4)){
    return voById(vehicleId).filter(x=>x.status!=='免繳' && (x.dueDate||x.paidDate||'').startsWith(year)).reduce((s,x)=>s+Number(x.amount||0),0);
  }
  function costBreakdown(){
    const year=today().slice(0,4); const fuel=vf().filter(x=>x.date.startsWith(year)).reduce((s,x)=>s+Number(x.amount||0),0);
    const maint=vm().filter(x=>x.date.startsWith(year));
    const regular=maint.filter(x=>x.type==='定期保養'||x.type==='故障維修').reduce((s,x)=>s+Number(x.total||0),0);
    const tires=maint.filter(x=>x.type==='輪胎').reduce((s,x)=>s+Number(x.total||0),0);
    const insurance=obligationRecognizedYearTotal(state.activeVehicleId,year,costRecognition); const other=0;
    return [{name:'燃油',value:fuel,color:COLORS[0]},{name:'定期保養',value:regular,color:COLORS[1]},{name:'輪胎',value:tires,color:COLORS[2]},{name:'保險稅金',value:insurance,color:COLORS[3]},{name:'其他',value:other,color:COLORS[4]}];
  }
  function renderDonut(){
    const data=costBreakdown(), total=data.reduce((s,x)=>s+x.value,0)||1; let acc=0; const stops=data.map(d=>{const a=acc/total*100;acc+=d.value;return `${d.color} ${a}% ${acc/total*100}%`;}).join(',');
    $('#costDonut').style.background=`conic-gradient(${stops})`; $('#donutTotal').textContent=money(total);
    $('#donutLegend').innerHTML=data.map(d=>`<div><i class="legend-swatch" style="background:${d.color}"></i><span>${d.name}</span><b>${Math.round(d.value/total*100)}%</b></div>`).join('');
  }
  function reminderText(r){
    const v=activeVehicle(); const km=r.targetKm!=null?r.targetKm-v.odometer:null; const days=daysUntil(r.targetDate);
    if(km!=null && days!=null){ return km<=0?`已逾期 ${num(Math.abs(km))} km`:days<=0?`日期已逾期 ${Math.abs(days)} 天`:`剩餘 ${num(km)} km／${days} 天`; }
    if(km!=null) return km<=0?`已逾期 ${num(Math.abs(km))} km`:`剩餘 ${num(km)} km`;
    if(days!=null) return days<=0?`已逾期 ${Math.abs(days)} 天`:`${days} 天內`;
    return '未設定期限';
  }
  function renderDashboardReminders(){
    const items=vr().map(r=>reminderInfoForVehicle(state.activeVehicleId,r)).sort((a,b)=>a.bucket-b.bucket||a.effectiveDays-b.effectiveDays).slice(0,4);
    $('#dashboardReminders').innerHTML=items.map((x,i)=>`<div class="reminder-row"><span class="r-icon">${['🛢','◉','🛡','🚙'][i%4]}</span><div>${esc(x.reminder.title)}：<strong>${esc(reminderRemainingText(x))}</strong></div></div>`).join('') || `<div class="empty">目前沒有提醒</div>`;
  }
  function renderMonthlySummary(){
    const rows=computeFuelRowsForVehicle(state.activeVehicleId).filter(x=>x.efficiency); const cur=rows.at(-1)?.efficiency||0; const prev=rows.at(-2)?.efficiency||0; const diff=cur-prev;
    const month=today().slice(0,7); const prevDate=new Date();prevDate.setMonth(prevDate.getMonth()-1);const pm=`${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;
    const fuel=vf();const curCost=fuel.filter(x=>monthKey(x.date)===month).reduce((s,x)=>s+x.amount,0);const prevCost=fuel.filter(x=>monthKey(x.date)===pm).reduce((s,x)=>s+x.amount,0);const pct=prevCost?((curCost-prevCost)/prevCost*100):null;
    const fuelTrend=rows.length>=2?`最近一次油耗較前次${diff>=0?'提升':'下降'} ${num(Math.abs(diff),1)} km/L`:'有效油耗資料不足，至少需要兩次加滿紀錄';
    const costTrend=pct==null?'上月油費資料不足，暫時無法比較':`本月油費較上月${pct<=0?'下降':'增加'} ${num(Math.abs(pct),0)}%`;
    const stability=rows.length>=3?`近三次有效油耗${rows.slice(-3).every(x=>x.efficiency>10)?'維持穩定':'需要留意'}`:`目前只有 ${rows.length} 次有效油耗，尚不足以判斷穩定性`;
    const lines=[fuelTrend,costTrend,stability,vm().filter(x=>x.date.startsWith(month)&&x.total>10000).length?'本月出現較高維修支出':'尚未出現異常保養支出'];
    $('#monthlySummary').innerHTML=lines.map(x=>`<div class="summary-row"><span class="r-icon">✓</span><span>${x}</span></div>`).join('');
  }

  function renderMaintenance(){
    const kw=$('#maintenanceKeyword')?.value.trim().toLowerCase()||''; const type=$('#maintenanceTypeFilter')?.value||''; const start=$('#maintenanceStart')?.value||''; const end=$('#maintenanceEnd')?.value||'';
    const rows=vm().filter(x=>(!kw||`${x.workOrder||''} ${x.items} ${x.vendor} ${x.notes}`.toLowerCase().includes(kw))&&(!type||x.type===type)&&(!start||x.date>=start)&&(!end||x.date<=end));
    $('#maintenanceTableBody').innerHTML=rows.map(x=>`<tr><td>${x.date}</td><td>${maintenanceOdometerText(x.odometer)}</td><td><span class="badge blue">${esc(x.type)}</span></td><td>${esc(x.vendor||'-')}</td><td>${esc(x.items)}</td><td>${money(x.total)}</td><td>${x.nextKm?`${num(x.nextKm)} km`:x.nextDate||'-'}</td><td>${x.details?.length?`<button class="action-btn" data-view-maint="${x.id}">明細</button>`:''}<button class="action-btn" data-edit-maint="${x.id}">編輯</button><button class="action-btn danger" data-del-maint="${x.id}">刪除</button></td></tr>`).join('')||`<tr><td colspan="8" class="empty">沒有符合條件的紀錄</td></tr>`;
  }

  function renderMaintenanceEvaluation(){
    const windowValue=$('#maintenanceEvaluationWindow').value||'5';
    const ev=maintenanceEvaluationForVehicle(state.activeVehicleId,windowValue);const v=ev.vehicle;
    const lowInput=$('#maintenanceBudgetLowInput'),highInput=$('#maintenanceBudgetHighInput'),majorInput=$('#majorRepairThresholdInput');
    if(document.activeElement!==lowInput)lowInput.value=Math.round(ev.budget.low);
    if(document.activeElement!==highInput)highInput.value=Math.round(ev.budget.high);
    if(document.activeElement!==majorInput)majorInput.value=Math.round(ev.budget.threshold);
    $('#maintenanceBudgetReference').innerHTML=`<strong>${esc(v.name)}｜${esc(ev.budget.band)}｜${esc(ev.budget.source)}</strong><span>${esc(ev.budget.reference)}</span><small>目前評估期間：${esc(ev.windowInfo.label)}。公開保養價格只能作為規劃參考，實際金額會受零件品牌、工資、故障原因及是否使用原廠件影響。</small>`;
    const quality=ev.total>0&&ev.age.years!=null?(ev.missingYears<=1?'資料可評估':'部分年度無工單'):'資料不足';
    const chip=$('#maintenanceEvaluationQualityChip');chip.textContent=quality;chip.className=`data-quality-chip ${quality==='資料可評估'?'good':quality==='部分年度無工單'?'normal':'warn'}`;
    const kpis=[
      ['車齡',ev.age.label,ev.age.stage,'#2f8cff'],
      ['年均行駛里程',ev.mileage.value!=null?`${num(ev.mileage.value)} km`:'資料不足',ev.mileage.quality,'#3dd6d0'],
      ['正常年度預算',`${money(ev.budget.low)}～${money(ev.budget.high)}`,'可自行調整的規劃區間','#f2a62b'],
      ['日曆年均實際支出',ev.total?money(ev.actualAvg):'$0',`${ev.windowInfo.label}｜總額 ${money(ev.total)}`,'#8b65ff'],
      ['有支出年度平均',ev.spendingYears?money(ev.activeYearAvg):'資料不足',`${ev.spendingYears} 個年度有工單`,'#ff6d7b'],
      ['維修支出效益',ev.finalScore!=null?`${ev.finalScore} 分`:'資料不足',`${ev.grade.label}｜必要支出占 ${num(ev.essentialRatio*100,0)}%`,'#49c96b']
    ];
    $('#maintenanceEvaluationKpis').innerHTML=kpis.map(c=>`<article class="kpi-card" style="--accent:${c[3]}"><div class="kpi-top"><span class="kpi-icon">◎</span><span>${c[0]}</span></div><div class="kpi-value">${c[1]}</div><div class="kpi-foot"><i></i></div><div class="kpi-note">${c[2]}</div></article>`).join('');

    const ageRisks=ev.age.years==null?['尚未輸入製造年月，無法依車齡評估。']:ev.age.years>=21?['油封、墊片、橡膠管與防塵套的時間老化','冷卻、電系、底盤與空調零件的突發修復','低里程不代表可以忽略年度油液與安全檢查']:ev.age.years>=11?['耗材與底盤零件開始進入集中更換期','應留意油液、皮帶、電瓶與冷卻系統']:['以定期保養與耗材更換為主要支出'];
    $('#maintenanceAgeStage').innerHTML=`<div class="maintenance-age-hero"><div class="maintenance-age-number">${ev.age.years!=null?ev.age.years:'—'}<small>年</small></div><div><span class="maintenance-stage-badge ${ev.age.stageKey}">${esc(ev.age.stage)}</span><h3>${esc(v.name)}｜${esc(ev.age.label)}</h3><p>${ev.mileage.value!=null?`年均行駛約 ${num(ev.mileage.value)} km。`:''}${ev.age.years>=20?'此階段維修費較容易由「里程耗材」轉為「時間老化＋偶發故障」。':'應依里程與時間雙軌安排保養。'}</p></div></div><div class="maintenance-risk-list">${ageRisks.map(x=>`<div><span>•</span><p>${esc(x)}</p></div>`).join('')}</div>`;

    const max=Math.max(ev.budget.high,ev.actualAvg,ev.activeYearAvg,1);const pct=n=>Math.min(100,n/max*100);
    $('#maintenanceBudgetComparison').innerHTML=`<div class="budget-comparison-summary"><div><small>判斷</small><strong class="budget-status ${ev.actualAvg>ev.budget.high?'warn':ev.actualAvg>=ev.budget.low?'good':'normal'}">${esc(ev.budgetStatus)}</strong></div><div><small>排除一次性大修後年均</small><strong>${money(ev.normalizedAvg)}</strong></div><div><small>一次性大修合計</small><strong>${money(ev.oneOffTotal)}</strong></div></div><div class="budget-bars"><div class="budget-bar-row"><label>合理下限</label><div><i style="width:${pct(ev.budget.low)}%"></i></div><b>${money(ev.budget.low)}</b></div><div class="budget-bar-row"><label>合理上限</label><div><i style="width:${pct(ev.budget.high)}%"></i></div><b>${money(ev.budget.high)}</b></div><div class="budget-bar-row actual"><label>日曆年均</label><div><i style="width:${pct(ev.actualAvg)}%"></i></div><b>${money(ev.actualAvg)}</b></div><div class="budget-bar-row active-year"><label>有支出年度</label><div><i style="width:${pct(ev.activeYearAvg)}%"></i></div><b>${money(ev.activeYearAvg)}</b></div></div><div class="budget-explain">日曆年均會把沒有工單的年度算入；有支出年度平均較適合觀察「進廠那一年通常花多少」。兩者應一起看。</div>`;

    const catTotal=Math.max(ev.total,1);
    $('#maintenanceBenefitBars').innerHTML=Object.entries(MAINTENANCE_BENEFIT_META).map(([key,meta])=>{const value=ev.categoryTotals[key]||0;return `<div class="benefit-bar-row"><div class="benefit-bar-label"><span style="--benefit-color:${meta.color}"></span><b>${meta.label}</b></div><div class="benefit-bar-track"><i style="width:${value/catTotal*100}%;--benefit-color:${meta.color}"></i></div><strong>${money(value)}</strong><small>${num(value/catTotal*100,0)}%</small></div>`;}).join('');

    $('#maintenanceEvaluationStrengths').innerHTML=ev.strengths.map(x=>`<div><span>✓</span><p>${esc(x)}</p></div>`).join('')||'<div><span>•</span><p>目前沒有足夠資料形成正向結論。</p></div>';
    $('#maintenanceEvaluationWarnings').innerHTML=ev.warnings.map(x=>`<div><span>!</span><p>${esc(x)}</p></div>`).join('')||'<div><span>✓</span><p>目前沒有明顯需要注意的異常。</p></div>';

    $('#maintenanceYearBody').innerHTML=ev.years.slice().reverse().map(y=>{let status='無工單';if(y.total>ev.budget.high)status='高於上限';else if(y.total>=ev.budget.low)status='合理範圍';else if(y.total>0)status='低於範圍';const badge=status==='合理範圍'?'green':status==='高於上限'?'red':status==='低於範圍'?'amber':'blue';return `<tr><td>${y.year}</td><td>${y.age!=null?`${y.age} 年`:'-'}</td><td>${y.items.length} 筆</td><td>${money(y.preventive)}</td><td>${money(y.repair)}</td><td>${money(y.major)}</td><td><strong>${money(y.total)}</strong></td><td><span class="badge ${badge}">${status}</span></td></tr>`;}).join('')||'<tr><td colspan="8" class="empty">沒有年度資料</td></tr>';

    $('#maintenanceBenefitBody').innerHTML=ev.assessments.slice().reverse().map(x=>{const ageAt=vehicleAgeInfo(v,x.order.date);const meta=MAINTENANCE_BENEFIT_META[x.dominant];const necessity=x.necessity==='高'?'green':x.necessity==='中'?'amber':'blue';return `<tr><td>${x.order.date}</td><td>${ageAt.years!=null?`${ageAt.years} 年`:'-'}</td><td><strong>${esc(x.order.items)}</strong><small class="table-subline">${esc(x.order.vendor||'未填維修廠')}</small></td><td>${money(x.total)}</td><td><span class="benefit-category-pill" style="--benefit-color:${meta.color}">${meta.label}</span></td><td><span class="badge ${necessity}">${x.necessity}</span></td><td>${x.oneOff?'<span class="badge red">是</span>':'否'}</td><td>${esc(x.explanation)}</td></tr>`;}).join('')||'<tr><td colspan="8" class="empty">選定期間沒有維修工單</td></tr>';

    $('#fleetMaintenanceEvaluationBody').innerHTML=state.vehicles.map(vehicle=>{const fe=maintenanceEvaluationForVehicle(vehicle.id,windowValue);return `<tr><td><strong>${esc(vehicle.name)}</strong><small class="table-subline">${esc(vehicle.plate||'未填車牌')}</small></td><td>${esc(fe.age.label)}</td><td>${fe.mileage.value!=null?`${num(fe.mileage.value)} km`:'資料不足'}</td><td>${money(fe.budget.low)}～${money(fe.budget.high)}</td><td>${fe.total?money(fe.actualAvg):'尚無工單'}</td><td>${fe.total?`${num(fe.essentialRatio*100,0)}%`:'-'}</td><td>${fe.finalScore!=null?`${fe.finalScore} 分`:'-'}</td><td><span class="badge ${fe.grade.key==='good'?'green':fe.grade.key==='normal'?'amber':'red'}">${fe.grade.label}</span></td></tr>`;}).join('');
    renderAgeDatabaseSimulation();
  }


  function renderFuel(){
    const type=$('#fuelTypeFilter')?.value||'';const start=$('#fuelStart')?.value||'';const end=$('#fuelEnd')?.value||'';const full=$('#fuelFullFilter')?.value||'';
    const all=computeFuelRows(); const rows=all.filter(x=>(!type||x.fuelType===type)&&(!start||x.date>=start)&&(!end||x.date<=end)&&(full===''||String(x.fullTank)===full)).reverse();
    $('#fuelTableBody').innerHTML=rows.map(x=>{const q=fuelQualityMeta(x);return `<tr><td>${x.date}${x.dateYearInferred?' <span class="estimated-mark">年份回推</span>':''}</td><td>${fuelOdometerText(x.odometer,x.odometerEstimated)}</td><td>${fuelDistanceText(x)}</td><td>${esc(x.fuelType)}</td><td>${fuelLitersText(x.liters,2,x.litersEstimated)}</td><td>${fuelUnitPriceText(x.unitPrice,2,x.unitPriceEstimated)}</td><td>${fuelAmountText(x)}</td><td><span class="badge ${fullTankBadge(x.fullTank,x.fullTankEstimated)}">${fullTankText(x.fullTank,x.fullTankEstimated)}</span></td><td>${fuelEfficiencyDisplay(x)}</td><td>${x.costPerKm?`${money2(x.costPerKm)}/km`:'-'}</td><td><span class="quality-status ${q.className}">${q.label}</span></td><td><button class="action-btn" data-edit-fuel="${x.id}">編輯</button><button class="action-btn danger" data-del-fuel="${x.id}">刪除</button></td></tr>`;}).join('')||`<tr><td colspan="12" class="empty">沒有符合條件的紀錄</td></tr>`;
    const m=metrics(); const knownFuel=all.filter(x=>hasPositiveNumber(x.liters)&&Number(x.amount)>0);const totalLiters=knownFuel.reduce((s,x)=>s+Number(x.liters),0);const knownAmount=knownFuel.reduce((s,x)=>s+Number(x.amount),0);const totalAmount=all.reduce((s,x)=>s+Number(x.amount||0),0);const avgPrice=totalLiters?knownAmount/totalLiters:0;
    const cards=[[m.latestEffEstimated?'最近推估油耗':'最近實際油耗',m.latestEff?`${num(m.latestEff,2)} km/L`:'資料不足','#3dd6d0'],['平均實付油價',`$${num(avgPrice,2)}/L`,'#f2a62b'],['已知加油量',`${num(totalLiters,1)} L`,'#2f8cff'],['累計燃油支出',money(totalAmount),'#8b65ff']];
    $('#fuelKpis').innerHTML=cards.map(c=>`<article class="kpi-card" style="--accent:${c[2]}"><div class="kpi-top"><span class="kpi-icon">⛽</span><span>${c[0]}</span></div><div class="kpi-value">${c[1]}</div><div class="kpi-foot"><i></i></div></article>`).join('');
  }

  function renderEfficiency(){
    const windowSetting=$('#efficiencyWindowSelect')?.value||'5';
    const pf=fuelPerformanceForVehicle(state.activeVehicleId,windowSetting);
    const v=pf.vehicle;
    $('#fuelTankCapacityInput').value=v.fuelTankCapacity??'';
    $('#reserveLitersInput').value=v.reserveLiters??'';
    $('#benchmarkEfficiencyInput').value=v.benchmarkEfficiency??'';
    $('#efficiencyReferenceNote').innerHTML=v.efficiencyReference?`<strong>目前參考：</strong>${esc(v.efficiencyReference)}`:'<strong>目前參考：</strong>尚未設定車型參考資料。';
    const chip=$('#efficiencyQualityChip');chip.textContent=pf.quality;chip.className=`data-quality-chip ${pf.quality.includes('完整')?'good':pf.quality.includes('不足')?'warn':'normal'}`;
    const kpis=[
      ['近期加權油耗',pf.avg?`${num(pf.avg,2)} km/L`:'資料不足',pf.selected.length?`採 ${pf.selected.length} 個有效週期`:'尚無有效週期','#3dd6d0'],
      ['完整油箱理論續航',pf.fullRange?`${num(pf.fullRange)} km`:'資料不足',pf.tank?`${num(pf.tank,1)} L × 近期油耗`:'尚未設定油箱容量','#2f8cff'],
      ['安全可用續航',pf.safeRange?`${num(pf.safeRange)} km`:'資料不足',pf.usable?`可用油量 ${num(pf.usable,1)} L`:'尚未設定安全預留','#49c96b'],
      ['保守續航',pf.conservativeRange?`${num(pf.conservativeRange)} km`:'資料不足',pf.conservativeEff?`採較低油耗 ${num(pf.conservativeEff,2)} km/L`:'有效週期不足','#f2a62b'],
      ['每100公里油費',pf.costPer100Km!=null?money(pf.costPer100Km):'資料不足','依週期實付金額加權','#8b65ff'],
      ['平均實際加油間距',pf.observedAverage?`${num(pf.observedAverage)} km`:'資料不足',pf.observedBest?`近期最高 ${num(pf.observedBest)} km`:'需要有效里程','#d8aa16']
    ];
    $('#efficiencyKpis').innerHTML=kpis.map(c=>`<article class="kpi-card" style="--accent:${c[3]}"><div class="kpi-top"><span class="kpi-icon">◌</span><span>${c[0]}</span></div><div class="kpi-value">${c[1]}</div><div class="kpi-foot"><i></i></div><div class="kpi-note">${c[2]}</div></article>`).join('');

    const grade=pf.grade;const score=grade.score;
    $('#efficiencyScoreValue').textContent=score==null?'—':`${score}%`;
    $('#efficiencyScoreGrade').textContent=grade.label;
    $('#efficiencyScoreRing').className=`efficiency-score-ring ${grade.className}`;
    $('#efficiencyScoreRing').style.setProperty('--score',score==null?0:Math.min(100,score));
    $('#efficiencyScoreBar').style.width=`${score==null?0:Math.min(100,score)}%`;
    $('#efficiencyScoreBar').className=`score-meter-fill ${grade.className}`;
    $('#efficiencyScoreText').textContent=pf.avg&&pf.benchmark?`近期加權油耗 ${num(pf.avg,2)} km/L，車型參考 ${num(pf.benchmark,2)} km/L，達成率 ${num(pf.ratio*100,0)}%。目前評價為「${grade.label}」。`:'請先補齊有效油耗週期及車型參考油耗。';

    const rangeRows=[
      ['理論滿油續航',pf.fullRange?`${num(pf.fullRange)} km`:'—','未扣除預留油量'],
      ['安全可用續航',pf.safeRange?`${num(pf.safeRange)} km`:'—',pf.reserve!=null?`保留 ${num(pf.reserve,1)} L`:'未設定預留'],
      ['保守建議續航',pf.conservativeRange?`${num(pf.conservativeRange)} km`:'—','長途規劃建議採此值'],
      ['近期實際加油間距',pf.observedAverage?`${num(pf.observedAverage)} km`:'—','依相鄰加油里程平均']
    ];
    $('#rangeValues').innerHTML=rangeRows.map(x=>`<div><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></div>`).join('');
    const roadPercent=pf.fullRange&&pf.safeRange?Math.max(0,Math.min(100,pf.safeRange/pf.fullRange*100)):0;
    $('#rangeRoadFill').style.width=`${roadPercent}%`;

    $('#efficiencyStrengths').innerHTML=performanceStrengths(pf).map(x=>`<div class="evaluation-item"><span>✓</span><p>${esc(x)}</p></div>`).join('');
    $('#efficiencyWeaknesses').innerHTML=performanceWeaknesses(pf).map(x=>`<div class="evaluation-item"><span>!</span><p>${esc(x)}</p></div>`).join('');

    const rows=pf.valid.slice().reverse();
    $('#efficiencyCycleBody').innerHTML=rows.map(x=>{
      const rel=pf.benchmark?efficiencyGrade(x.efficiency/pf.benchmark):{label:'未評估',className:'neutral'};
      return `<tr><td>${x.date}</td><td>${num(x.distance)} km</td><td>${num(x.cycleLiters,2)} L</td><td><strong>${num(x.efficiency,2)} km/L</strong></td><td>${x.costPerKm?money(x.costPerKm*100):'-'}</td><td><span class="performance-badge ${rel.className}">${rel.label}</span></td><td>${x.efficiencyEstimated?'<span class="estimated-mark">含估算</span>':'實際輸入'}</td></tr>`;
    }).join('')||'<tr><td colspan="7" class="empty">尚無有效油耗週期</td></tr>';

    $('#fleetEfficiencyBody').innerHTML=state.vehicles.map(vehicle=>{
      const x=fuelPerformanceForVehicle(vehicle.id,windowSetting);
      return `<tr><td>${esc(vehicle.name)}<div class="muted">${esc(vehicle.plate||'未填車牌')}</div></td><td>${x.avg?`${num(x.avg,2)} km/L`:'待補資料'}</td><td>${x.benchmark?`${num(x.benchmark,2)} km/L`:'未設定'}</td><td>${x.ratio?`${num(x.ratio*100,0)}%`:'—'}</td><td>${x.safeRange?`${num(x.safeRange)} km`:'—'}</td><td>${x.conservativeRange?`${num(x.conservativeRange)} km`:'—'}</td><td><span class="performance-badge ${x.grade.className}">${x.grade.label}</span></td></tr>`;
    }).join('');
  }

  function monthsInclusive(start,end){
    if(!start||!end)return [];
    const a=parseDate(start),b=parseDate(end);if(!a||!b||a>b)return [];
    const out=[];const d=new Date(a.getFullYear(),a.getMonth(),1);const last=new Date(b.getFullYear(),b.getMonth(),1);
    while(d<=last&&out.length<240){out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);d.setMonth(d.getMonth()+1);}
    return out;
  }
  function obligationMonthlyAmount(vehicleId,key,mode=costRecognition){
    const rows=voById(vehicleId).filter(o=>o.status!=='免繳'&&Number(o.amount)>0);
    if(mode==='cash') return rows.filter(o=>o.status==='已繳'&&monthKey(o.paidDate||o.dueDate||'0000-00-00')===key).reduce((s,o)=>s+Number(o.amount),0);
    return rows.reduce((sum,o)=>{
      let months=monthsInclusive(o.periodStart,o.periodEnd);
      if(!months.length&&o.dueDate){const y=o.dueDate.slice(0,4);months=Array.from({length:12},(_,i)=>`${y}-${String(i+1).padStart(2,'0')}`);}
      return months.includes(key)?sum+Number(o.amount)/months.length:sum;
    },0);
  }
  function obligationRecognizedYearTotal(vehicleId=state.activeVehicleId,year=today().slice(0,4),mode=costRecognition){
    return Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,'0')}`).reduce((sum,key)=>sum+obligationMonthlyAmount(vehicleId,key,mode),0);
  }
  function renderAnalysis(){
    const data=costBreakdown(), rawTotal=data.reduce((s,x)=>s+x.value,0), total=rawTotal||1;let acc=0;const stops=data.map(d=>{const a=acc/total*100;acc+=d.value;return `${d.color} ${a}% ${acc/total*100}%`;}).join(',');
    $('#analysisDonut').style.background=rawTotal?`conic-gradient(${stops})`:'rgba(255,255,255,.06)';$('#analysisTotal').textContent=money(rawTotal);$('#analysisYearLabel').textContent=`${today().slice(0,4)} 年｜${costRecognition==='cash'?'現金制':'攤提制'}`;
    $('#analysisLegend').innerHTML=data.map(d=>`<div><i class="legend-swatch" style="background:${d.color}"></i><span>${d.name}</span><b>${money(d.value)}</b></div>`).join('');
    const m=metrics();const fixedYear=obligationRecognizedYearTotal(state.activeVehicleId,today().slice(0,4),costRecognition);const hasDistance=Number.isFinite(m.yearDistance)&&m.yearDistance>0;
    const maintKm=hasDistance?m.maintYear/m.yearDistance:null;const totalKmCost=hasDistance?(m.fuelYear+m.maintYear+fixedYear)/m.yearDistance:null;
    const cc=[
      ['燃油成本',m.fuelCostKm?`${money2(m.fuelCostKm)}/km`:'資料不足','依近三次有效加滿紀錄'],
      ['維修保養',maintKm!=null?`${money2(maintKm)}/km`:'資料不足',hasDistance?'本年度維修費 ÷ 有效年度里程':m.distanceInfo.message],
      ['綜合養車成本',totalKmCost!=null?`${money2(totalKmCost)}/km`:'資料不足',hasDistance?`含燃油、保養與${costRecognition==='cash'?'現金制':'攤提制'}固定支出`:m.distanceInfo.message],
      ['年度行駛里程',hasDistance?`${num(m.yearDistance)} km`:'資料不足',`${m.distanceInfo.quality}｜${m.distanceInfo.message}`]
    ];
    $('#costCards').innerHTML=cc.map(x=>`<div class="cost-card"><small>${x[0]}</small><strong>${x[1]}</strong><span>${esc(x[2])}</span></div>`).join('');
    $('#costRecognitionSelect').value=costRecognition;
    renderCostChart();
  }

  function renderCostChart(){
    const svg=$('#costChart');const now=new Date();const months=[];for(let i=11;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)}
    const data=months.map(k=>{const fuel=vf().filter(x=>monthKey(x.date)===k).reduce((s,x)=>s+Number(x.amount||0),0);const maint=vm().filter(x=>monthKey(x.date)===k).reduce((s,x)=>s+Number(x.total||0),0);const fixed=obligationMonthlyAmount(state.activeVehicleId,k,costRecognition);return {key:k,label:`${Number(k.slice(5))}月`,fullLabel:`${k.slice(0,4)}年${Number(k.slice(5))}月`,fuel,maint,fixed,total:fuel+maint+fixed};});
    const W=1000,H=360,p={l:60,r:25,t:30,b:45},iw=W-p.l-p.r,ih=H-p.t-p.b,max=Math.max(3000,...data.map(x=>x.total))*1.15;let out='';
    for(let i=0;i<=4;i++){const y=p.t+ih*i/4;out+=`<line class="chart-grid" x1="${p.l}" y1="${y}" x2="${W-p.r}" y2="${y}"/><text class="chart-label" x="${p.l-12}" y="${y+4}" text-anchor="end">${num(max*(4-i)/4,0)}</text>`}
    const group=iw/data.length,bw=Math.min(20,group*.22);data.forEach((d,i)=>{const x=p.l+i*group+group/2;const hf=d.fuel/max*ih,hm=d.maint/max*ih,hx=d.fixed/max*ih;out+=`<rect x="${x-bw*1.5}" y="${p.t+ih-hf}" width="${bw}" height="${hf}" rx="4" fill="#2f8cff"/><rect x="${x-bw/2}" y="${p.t+ih-hm}" width="${bw}" height="${hm}" rx="4" fill="#8b65ff"/><rect x="${x+bw/2}" y="${p.t+ih-hx}" width="${bw}" height="${hx}" rx="4" fill="#f2a62b"/><text class="chart-label" x="${x}" y="${H-18}" text-anchor="middle">${d.label}</text><rect class="chart-hover-zone" data-chart-index="${i}" x="${p.l+i*group}" y="${p.t}" width="${group}" height="${ih}" fill="transparent"/>`});
    svg.innerHTML=out;
    bindChartTooltip(svg,data,d=>`<strong>${esc(d.fullLabel)}</strong><div><span>燃油費</span><b>${money(d.fuel)}</b></div><div><span>維修保養</span><b>${money(d.maint)}</b></div><div><span>稅金／保險／驗車</span><b>${money(d.fixed)}</b></div><div class="chart-tooltip-total"><span>當月合計</span><b>${money(d.total)}</b></div><small>${costRecognition==='cash'?'現金制：依實際繳費月份':'攤提制：年度固定支出平均分攤'}</small>`);
  }

  function serviceShopPresetDateValues(value){
    if(value==='all')return {start:'',end:''};
    const years=Math.max(1,Number(value)||5);const end=today();const d=new Date(`${end}T00:00:00`);d.setFullYear(d.getFullYear()-years);
    const startDate=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return {start:startDate,end};
  }
  function serviceShopRangeInfo(value,startDate='',endDate=''){
    if(value==='all')return {value:'all',label:'全部已輸入紀錄',start:'',end:''};
    if(value==='custom'){
      const start=/^\d{4}-\d{2}-\d{2}$/.test(startDate)?startDate:'';
      const end=/^\d{4}-\d{2}-\d{2}$/.test(endDate)?endDate:'';
      const label=start&&end?`${start} ～ ${end}`:start?`${start} 之後`:end?`${end} 以前`:'自訂日期（顯示全部）';
      return {value:'custom',label,start,end};
    }
    const years=Math.max(1,Number(value)||5);const preset=serviceShopPresetDateValues(String(years));
    return {value:String(years),label:`最近 ${years} 年｜${preset.start} ～ ${preset.end}`,start:preset.start,end:preset.end};
  }
  function serviceShopControlRange(){
    const mode=$('#serviceShopYears')?.value||'5';
    if(mode!=='custom'){
      const preset=serviceShopPresetDateValues(mode);
      if($('#serviceShopStartDate'))$('#serviceShopStartDate').value=preset.start;
      if($('#serviceShopEndDate'))$('#serviceShopEndDate').value=preset.end;
      return serviceShopRangeInfo(mode,preset.start,preset.end);
    }
    return serviceShopRangeInfo('custom',$('#serviceShopStartDate')?.value||'',$('#serviceShopEndDate')?.value||'');
  }
  function normalizeServiceShopCustomDates(changed=''){
    const startInput=$('#serviceShopStartDate');const endInput=$('#serviceShopEndDate');if(!startInput||!endInput)return;
    const maxDate=today();startInput.max=maxDate;endInput.max=maxDate;
    if(startInput.value>maxDate)startInput.value=maxDate;if(endInput.value>maxDate)endInput.value=maxDate;
    if(startInput.value&&endInput.value&&startInput.value>endInput.value){
      if(changed==='end')startInput.value=endInput.value;else endInput.value=startInput.value;
      toast('起始日期不可晚於結束日期，已自動調整日期區間。');
    }
  }
  function serviceShopHistoryData(vehicleId,rangeValue='5',startDate='',endDate=''){
    const vehicle=vehicleById(vehicleId);const range=serviceShopRangeInfo(rangeValue,startDate,endDate);
    const orders=vmById(vehicleId).filter(x=>(!range.start||x.date>=range.start)&&(!range.end||x.date<=range.end));
    const items=[];
    orders.forEach(order=>{
      const details=(order.details||[]).filter(d=>String(d.category||'')!=='工資');
      if(details.length){
        details.forEach(d=>items.push({date:order.date,odometer:order.odometer,name:d.name||order.items,category:d.category||order.type,vendor:order.vendor||'',workOrder:order.workOrder||'',amount:Number(d.amount)||0,orderId:order.id,note:d.note||''}));
      }else items.push({date:order.date,odometer:order.odometer,name:order.items,category:order.type,vendor:order.vendor||'',workOrder:order.workOrder||'',amount:Number(order.total)||0,orderId:order.id,note:order.notes||''});
    });
    const assessments=partEvaluationForVehicle(vehicleId);
    const priority=assessments.filter(x=>['due','soon','inspect','unknown'].includes(x.status));
    const recentlyDone=assessments.filter(x=>x.lastDate&&x.replacementRatio<.8&&x.status==='normal').sort((a,b)=>(b.lastDate||'').localeCompare(a.lastDate||''));
    return {vehicle,range,orders,items,assessments,priority,recentlyDone};
  }
  function serviceShopPriorityLabel(row){
    return row.status==='due'?'優先處理':row.status==='soon'?'接近週期':row.status==='inspect'?'建議檢查':row.status==='unknown'?'補查紀錄':'正常';
  }
  function renderServiceShopList(){
    const selectedRange=serviceShopControlRange();const includeCosts=!!$('#serviceShopIncludeCosts').checked;const data=serviceShopHistoryData(state.activeVehicleId,selectedRange.value,selectedRange.start,selectedRange.end);const v=data.vehicle;
    $('#serviceShopVehicleInfo').innerHTML=`目前車輛：<strong>${esc(v.name)}</strong>${v.plate?`｜車牌 ${esc(v.plate)}`:''}｜目前里程 ${num(v.odometer)} km｜製造年月 ${esc(v.manufactureDate||v.year||'未填')}`;
    const latest=data.orders[0];
    $('#serviceShopKpis').innerHTML=[
      ['歷史工單',`${data.orders.length} 張`,data.range.label],['零件／作業',`${data.items.length} 項`,'已排除純工資明細'],['最近進廠',latest?.date||'尚無資料',latest?`${latest.vendor||'未填維修廠'}｜${maintenanceOdometerText(latest.odometer)}`:''],['本次重點',`${data.priority.length} 項`,'優先、接近週期、建議檢查及缺紀錄']
    ].map(x=>`<div class="service-shop-kpi"><small>${esc(x[0])}</small><strong>${esc(x[1])}</strong><span>${esc(x[2])}</span></div>`).join('');
    $('#serviceShopHistorySummary').textContent=`${data.range.label}｜${data.items.length} 項`;
    $('#serviceShopHistoryBody').innerHTML=data.items.map(x=>`<tr><td>${esc(x.date)}</td><td>${maintenanceOdometerText(x.odometer)}</td><td><strong>${esc(x.name)}</strong>${x.category?`<span class="service-shop-inline-meta">｜${esc(x.category)}</span>`:''}</td><td>${esc(x.vendor||'-')}</td><td>${esc(x.workOrder||'-')}</td><td>${includeCosts?money(x.amount):'<span class="muted">已隱藏</span>'}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">所選期間沒有維修紀錄</td></tr>';
    $('#serviceShopPriorityBody').innerHTML=data.priority.slice(0,18).map(x=>`<tr><td><span class="service-shop-priority ${x.status}">${serviceShopPriorityLabel(x)}</span></td><td><strong>${esc(x.std.name)}</strong><span class="service-shop-inline-meta">｜${esc(x.std.category)}｜${esc(x.std.applicability)}</span></td><td>${x.lastDate?`${esc(x.lastDate)}${x.lastKm!=null?`｜${num(x.lastKm)} km｜${esc(x.source)}`:''}`:'<span class="muted">無可追溯紀錄</span>'}</td><td>${esc(x.reason)}</td><td>${esc(x.action)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">目前沒有需要特別檢查的項目</td></tr>';
  }
  function serviceShopReportHtml(vehicleId,rangeValue='5',includeCosts=false,startDate='',endDate=''){
    const data=serviceShopHistoryData(vehicleId,rangeValue,startDate,endDate);const v=data.vehicle;const latest=data.orders[0];
    const summary=reportSummaryCards([
      ['車齡／製造年月',vehicleAgeInfo(v).label,esc(v.manufactureDate||v.year||'未填')],['目前里程',`${num(v.odometer)} km`],['歷史工單',`${data.orders.length} 張`,data.range.label],['已更換／作業',`${data.items.length} 項`],['最近進廠',latest?.date||'尚無資料',latest?.vendor||''],['本次重點檢查',`${data.priority.length} 項`],['近期仍在週期內',`${data.recentlyDone.length} 項`,'避免未檢查就重複更換'],['歷史金額',includeCosts?'顯示':'隱藏','避免影響本次報價判斷']
    ]);
    const orderHeaders=['日期','里程','維修廠','工單編號','工單摘要'];if(includeCosts)orderHeaders.push('總額');
    const orderRows=data.orders.map(x=>{const row=[esc(x.date),maintenanceOdometerText(x.odometer),esc(x.vendor||'-'),esc(x.workOrder||'-'),esc(x.items)];if(includeCosts)row.push(money(x.total));return row;});
    const detailHeaders=['日期','里程','分類','已更換零件／作業','維修廠'];if(includeCosts)detailHeaders.push('歷史金額');
    const detailRows=data.items.map(x=>{const row=[esc(x.date),maintenanceOdometerText(x.odometer),esc(x.category||'-'),`${esc(x.name)}${x.note?`<br><small>${esc(x.note)}</small>`:''}`,esc(x.vendor||'-')];if(includeCosts)row.push(money(x.amount));return row;});
    const recentRows=data.recentlyDone.map(x=>[esc(x.std.name),esc(x.std.category),esc(x.lastDate||'-'),x.lastKm!=null?`${num(x.lastKm)} km`:'-',esc(x.source),`${num(x.replacementRatio*100,0)}%`,esc('目前仍在標準週期內，除非檢查異常，避免直接重複更換。')]);
    const priorityRows=data.priority.map(x=>[serviceShopPriorityLabel(x),esc(x.std.name),esc(x.std.category),esc(x.lastDate?`${x.lastDate}${x.lastKm!=null?`／${num(x.lastKm)} km`:''}`:'無紀錄'),`<span class="wrap-cell">${esc(x.reason)}</span>`,`<span class="wrap-cell">${esc(x.action)}</span>`,'□ 正常　□ 注意　□ 建議更換']);
    const blankRows=Array.from({length:8},(_,i)=>[String(i+1),'','□ 正常　□ 注意　□ 建議更換　□ 已更換','','']);
    const vehicleInfo=`<div class="info-grid"><div class="info-item"><b>車輛</b><span>${esc(v.name)}</span></div><div class="info-item"><b>車牌</b><span>${esc(v.plate||'未填')}</span></div><div class="info-item"><b>製造年月</b><span>${esc(v.manufactureDate||v.year||'未填')}</span></div><div class="info-item"><b>目前里程</b><span>${num(v.odometer)} km</span></div><div class="info-item"><b>燃料</b><span>${esc(v.fuelType||'未填')}</span></div><div class="info-item"><b>保養方式</b><span>${esc(v.maintenanceMode||'未設定')}</span></div></div>`;
    return `<div class="service-shop-report"><div class="cover"><h1>${esc(v.name)}｜維修廠查看清單</h1><div class="subtitle">歷年已更換零件、維修紀錄與本次建議檢查事項</div><div class="meta"><span>車牌：${esc(v.plate||'未填')}</span><span>資料範圍：${esc(data.range.label)}</span><span>產生日期：${today()}</span></div></div><div class="note warning"><strong>給技師：</strong>請先核對歷史已更換項目，再依現況量測與檢查。本表的週期判斷是篩檢參考，檢查型零件不應只因車齡或年份直接更換。</div>${summary}${reportSection('車輛基本資料',vehicleInfo,'no-break')}${reportSection('近年維修工單總覽',reportTable(orderHeaders,orderRows))}${reportSection('歷年已更換零件／維修作業明細',reportTable(detailHeaders,detailRows))}${reportSection('近期已做過、避免未檢查就重複更換',reportTable(['零件／耗材','分類','最近日期','最近里程','資料來源','週期使用率','提醒'],recentRows),'no-break')}${reportSection('本次請技師重點檢查',reportTable(['優先度','零件／系統','分類','最近紀錄','判斷原因','建議行動','技師勾選'],priorityRows))}${reportSection('技師現場檢查／新增建議',reportTable(['項次','檢查或維修項目','檢查結果','報價／預估','技師說明'],blankRows),'no-break')}<div class="info-grid"><div class="info-item"><b>維修廠／技師</b><span>　　　　　　　　　　　　</span></div><div class="info-item"><b>檢查日期</b><span>　　　年　　月　　日</span></div><div class="info-item"><b>車主確認</b><span>　　　　　　　　　　　　</span></div></div></div>`;
  }

  function renderReminders(){
    const rows=vr().map(r=>reminderInfoForVehicle(state.activeVehicleId,r)).sort((a,b)=>a.bucket-b.bucket||a.effectiveDays-b.effectiveDays);
    $('#reminderCards').innerHTML=rows.map((x,i)=>{const r=x.reminder;return `<article class="reminder-card" style="--accent:${COLORS[i%COLORS.length]}"><span class="badge ${x.bucket===0?'red':x.bucket===1?'amber':'blue'}">${esc(r.category)}</span>${r.sourceId?'<span class="auto-sync-label">自動同步</span>':''}<h3>${esc(r.title)}</h3><p>${esc(r.notes||'未填寫說明')}</p><div class="reminder-meta"><span>里程目標：${r.targetKm?`${num(r.targetKm)} km`:'未設定'}</span><span>日期目標：${r.targetDate||'未設定'}</span><strong>${esc(reminderRemainingText(x))}</strong></div><div class="card-actions"><button class="action-btn" data-edit-reminder="${r.id}">編輯</button>${r.sourceId?'':`<button class="action-btn danger" data-del-reminder="${r.id}">刪除</button>`}</div></article>`;}).join('')||`<div class="empty">目前沒有保養提醒</div>`;
  }

  function obligationDueText(o){
    if(o.status==='已繳') return o.estimatedPaid?'依年度持有推定已繳（日期待核對）':o.paidDate?`已於 ${o.paidDate} 繳納`:'已繳納';
    if(o.status==='免繳') return '免繳';
    if(o.status==='待確認') return o.dueDate?`繳納狀態待確認｜原期限 ${o.dueDate}`:'繳納狀態待確認';
    const days=daysUntil(o.dueDate);
    if(days==null) return '未設定到期日';
    if(days<0) return `逾期 ${Math.abs(days)} 天`;
    if(days===0) return '今天到期';
    return `剩餘 ${days} 天`;
  }
  function obligationStatusClass(status){ return status==='已繳'?'paid':status==='免繳'?'exempt':'waiting'; }
  function renderObligations(){
    const type=$('#obligationTypeFilter')?.value||'';
    const status=$('#obligationStatusFilter')?.value||'';
    const keyword=$('#obligationKeyword')?.value.trim().toLowerCase()||'';
    const yearSelect=$('#obligationYearFilter');
    const allYears=[...new Set([today().slice(0,4),...vo().flatMap(x=>[(x.dueDate||'').slice(0,4),(x.paidDate||'').slice(0,4),(x.periodStart||'').slice(0,4)]).filter(Boolean)])].sort((a,b)=>b.localeCompare(a));
    const currentValue=yearSelect?.dataset.ready==='1'?yearSelect.value:today().slice(0,4);
    if(yearSelect){yearSelect.innerHTML=`<option value="">全部年度</option>`+allYears.map(y=>`<option value="${y}">${y} 年</option>`).join('');yearSelect.value=currentValue;yearSelect.dataset.ready='1';}
    const year=yearSelect?.value||'';
    const rows=vo().filter(x=>(!type||x.type===type)&&(!status||x.status===status)&&(!year||`${x.dueDate} ${x.paidDate} ${x.periodStart} ${x.periodEnd}`.includes(year))&&(!keyword||`${x.provider} ${x.referenceNo} ${x.notes}`.toLowerCase().includes(keyword)));
    $('#obligationVehicleLabel').textContent=`${activeVehicle().name}${activeVehicle().plate?`｜${activeVehicle().plate}`:''}`;
    $('#obligationTableBody').innerHTML=rows.map(x=>`<tr><td><span class="badge blue">${esc(x.type)}</span></td><td>${esc(x.provider||'-')}</td><td>${x.periodStart||x.periodEnd?`${x.periodStart||'—'} ～ ${x.periodEnd||'—'}`:'-'}</td><td>${x.dueDate||'-'}<div class="muted">${obligationDueText(x)}</div></td><td>${money(x.amount)}</td><td>${x.paidDate||'-'}</td><td><span class="obligation-status-pill ${obligationStatusClass(x.status)}">${esc(x.estimatedPaid?'推定已繳':x.status)}</span></td><td>${esc(x.referenceNo||'-')}</td><td>${['待繳','待確認'].includes(x.status)?`<button class="action-btn" data-pay-obligation="${x.id}">設為已繳</button>`:''}<button class="action-btn" data-edit-obligation="${x.id}">編輯</button><button class="action-btn danger" data-del-obligation="${x.id}">刪除</button></td></tr>`).join('')||`<tr><td colspan="9" class="empty">沒有符合條件的紀錄</td></tr>`;
    const analysisYear=year||today().slice(0,4);
    const yearRows=vo().filter(x=>`${x.dueDate} ${x.paidDate} ${x.periodStart}`.includes(analysisYear));
    const paidTotal=yearRows.filter(x=>x.status==='已繳').reduce((s,x)=>s+Number(x.amount||0),0);
    const waitingTotal=yearRows.filter(x=>['待繳','待確認'].includes(x.status)).reduce((s,x)=>s+Number(x.amount||0),0);
    const upcoming=vo().filter(x=>['待繳','待確認'].includes(x.status)).sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999'));
    const next=upcoming[0];
    $('#obligationKpis').innerHTML=[['本年度已繳金額',money(paidTotal),'#49c96b'],['本年度待繳金額',money(waitingTotal),'#f2a62b'],['下一個到期項目',next?esc(next.type):'目前沒有', '#2f8cff'],['目前紀錄數',`${num(vo().length)} 筆`,'#8b65ff']].map(c=>`<article class="kpi-card" style="--accent:${c[2]}"><div class="kpi-top"><span class="kpi-icon">▣</span><span>${c[0]}</span></div><div class="kpi-value">${c[1]}</div><div class="kpi-foot"><i></i></div>${c[0]==='下一個到期項目'&&next?`<div class="kpi-note">${next.dueDate||'未設定日期'}｜${obligationDueText(next)}</div>`:''}</article>`).join('');
    $('#obligationUpcoming').innerHTML=upcoming.slice(0,6).map(x=>{const d=daysUntil(x.dueDate);const cls=d!=null&&d<0?'overdue':'';return `<div class="obligation-upcoming-item ${cls}"><div class="head"><strong>${esc(x.type)}</strong><span>${money(x.amount)}</span></div><small>${esc(x.provider||'未填承辦單位')}｜${x.dueDate||'未設定日期'}</small><span class="remain">${obligationDueText(x)}</span></div>`;}).join('')||`<div class="empty">目前沒有待繳事項</div>`;
    const groups=['保險','強制險','任意險','牌照稅','公路養管費','燃料使用費','驗車','其他'].map(name=>({name,value:yearRows.filter(x=>x.type===name&&x.status!=='免繳').reduce((s,x)=>s+Number(x.amount||0),0)}));
    const max=Math.max(1,...groups.map(x=>x.value));$('#obligationYearLabel').textContent=`${analysisYear} 年`;
    $('#obligationBars').innerHTML=groups.map(x=>`<div class="obligation-bar-row"><span>${x.name}</span><div class="obligation-bar-track"><i style="width:${x.value/max*100}%"></i></div><b>${money(x.value)}</b></div>`).join('');
  }

  function renderVehicleForm(){ const v=activeVehicle(); const f=$('#vehicleForm'); if(!v) return; Object.entries(v).forEach(([k,val])=>{const el=f.elements[k];if(el)el.value=val??''}); }
  function renderMileageHistory(){
    const info=calculateYearDistance(state.activeVehicleId); const points=mileagePointsForVehicle(state.activeVehicleId).slice().reverse().slice(0,30);
    $('#mileageQualityText').textContent=`${info.quality}｜${info.message}`;
    $('#mileageLogBody').innerHTML=points.map(x=>`<tr><td>${x.date}</td><td>${num(x.odometer)} km</td><td><span class="badge ${x.estimated?'amber':x.manual?'amber':'blue'}">${esc(x.source)}</span></td><td>${esc(x.notes||'-')}</td><td>${x.manual?`<button class="action-btn danger" data-del-mileage="${x.id}">刪除</button>`:'<span class="muted">由來源紀錄管理</span>'}</td></tr>`).join('')||`<tr><td colspan="5" class="empty">尚無里程紀錄</td></tr>`;
  }
  function setQuickDefaults(){ const f=$('#quickFuelForm'); const v=activeVehicle(); $('#quickVehicleBanner').textContent=`本次紀錄車輛：${v.name}${v.plate?`｜${v.plate}`:''}`; if(document.activeElement?.closest('#quickFuelForm')) return;f.elements.date.value=today();f.elements.odometer.value=v.odometer;f.elements.fuelType.value=v.fuelType||'95無鉛';f.elements.fullTank.value='true'; }

  function openMileageModal(){
    openModal({eyebrow:'里程歷史',title:'新增手動里程紀錄',submitText:'儲存里程',fields:[['date','日期','date',today(),true],['odometer','里程','number',activeVehicle().odometer||0,true],['source','來源','select','手動',true,['手動','月底抄表','年度起始','年度結束','其他']],['notes','備註','textarea','',false]],onSubmit:data=>{
      const item={id:uid(),vehicleId:state.activeVehicleId,date:data.date,odometer:+data.odometer||0,source:data.source||'手動',notes:data.notes||''};
      if(!ensureOdometerEntryValid({vehicleId:item.vehicleId,date:item.date,odometer:item.odometer,kind:'mileage',id:item.id}))return;
      state.mileageLogs ||= []; state.mileageLogs.push(item); activeVehicle().odometer=Math.max(Number(activeVehicle().odometer)||0,item.odometer); closeModal();renderAll();toast('里程紀錄已儲存');
    }});
  }

  function openFuelModal(id=null){
    const row=id?state.fuel.find(x=>x.id===id):null;
    openModal({eyebrow:'加油紀錄',title:row?'編輯加油紀錄':'新增加油紀錄',submitText:'儲存加油紀錄',fields:[
      ['date','日期','date',row?.date||today(),true],['odometer','目前里程（可留空）','number',row?.odometer??'',false],['fuelType','油品','select',row?.fuelType||activeVehicle().fuelType||'95無鉛',true,['汽油（油品未註明）','92無鉛','95無鉛','98無鉛','柴油','其他']],['liters','加油公升數（可留空）','number',row?.liters??'',false],['unitPrice','每公升單價（可留空）','number',row?.unitPrice??'',false],['amount','實付金額','number',row?.amount??'',true],['fullTank','是否加滿','select',row?(row.fullTank===true?'true':row.fullTank===false?'false':'unknown'):'true',true,[['true','是（預設）'],['false','否／部分加油'],['unknown','未確認']]],['station','加油站','text',row?.station??'',false],['usage','用途','select',row?.usage||'家庭',false,['個人','家庭','牧場','公務','其他']],['notes','備註','textarea',row?.notes??'',false]
    ],onSubmit:data=>{
      const nextOdometer=nullableNumber(data.odometer);const nextFullTank=data.fullTank==='true'?true:data.fullTank==='false'?false:null;
      const item={id:row?.id||uid(),vehicleId:state.activeVehicleId,date:data.date,odometer:nextOdometer,odometerEstimated:!!(row?.odometerEstimated&&Number(nextOdometer)===Number(row.odometer)),odometerEstimateMethod:row?.odometerEstimateMethod||'',fuelType:data.fuelType,liters:nullableNumber(data.liters),unitPrice:nullableNumber(data.unitPrice),amount:+data.amount||(hasPositiveNumber(data.liters)&&hasPositiveNumber(data.unitPrice)?Math.round(+data.liters*+data.unitPrice):0),fullTank:nextFullTank,fullTankEstimated:!!(row?.fullTankEstimated&&nextFullTank===row.fullTank),station:data.station,usage:data.usage,notes:data.notes,litersEstimated:!!(row?.litersEstimated&&Number(data.liters)===Number(row.liters)),unitPriceEstimated:!!(row?.unitPriceEstimated&&Number(data.unitPrice)===Number(row.unitPrice)),priceSource:row?.priceSource||'',distanceProvided:row?.distanceProvided??null,distanceEstimated:!!row?.distanceEstimated,dateYearInferred:!!row?.dateYearInferred,dataQualityStatus:row?.dataQualityStatus||'confirmed',userConfirmed:row?.userConfirmed??!row,dataQualityNotes:row?.dataQualityNotes||''};
      if(hasPositiveNumber(item.odometer)&&!ensureOdometerEntryValid({vehicleId:item.vehicleId,date:item.date,odometer:item.odometer,kind:'fuel',id:item.id}))return;
      upsert(state.fuel,item); if(hasPositiveNumber(item.odometer))activeVehicle().odometer=Math.max(activeVehicle().odometer,item.odometer); closeModal();renderAll();toast('加油紀錄已儲存');
    }});
  }
  function openMaintenanceModal(id=null){
    const row=id?state.maintenance.find(x=>x.id===id):null;
    openModal({eyebrow:'維修保養工單',title:row?'編輯維修保養工單':'新增維修保養工單',submitText:'儲存工單',fields:[
      ['date','進廠日期','date',row?.date||today(),true],['odometer','當時里程','number',row?.odometer??activeVehicle().odometer,true],['type','工單類型','select',row?.type||'定期保養',true,['定期保養','故障維修','輪胎','鈑金烤漆','事故維修','其他']],['vendor','維修廠／保養廠','text',row?.vendor??'',false],['items','維修保養項目','textarea',row?.items??'',true],['parts','零件金額','number',row?.parts??0,false],['labor','工資','number',row?.labor??0,false],['discount','折扣','number',row?.discount??0,false],['total','本次總金額','number',row?.total??'',false],['nextKm','下次更換里程','number',row?.nextKm??'',false],['nextDate','下次更換日期','date',row?.nextDate??'',false],['warrantyDate','保固期限','date',row?.warrantyDate??'',false],['notes','備註','textarea',row?.notes??'',false]
    ],onSubmit:data=>{const total=+data.total||Math.max(0,(+data.parts||0)+(+data.labor||0)-(+data.discount||0));const item={id:row?.id||uid(),vehicleId:state.activeVehicleId,date:data.date,invoiceDate:row?.invoiceDate||'',odometer:nullableNumber(data.odometer),type:data.type,vendor:data.vendor,workOrder:row?.workOrder||'',items:data.items,parts:+data.parts||0,labor:+data.labor||0,discount:+data.discount||0,total,nextKm:data.nextKm?+data.nextKm:null,nextDate:data.nextDate||null,warrantyDate:data.warrantyDate||null,notes:data.notes,attachment:row?.attachment||'',details:row?.details||[],dateYearInferred:!!row?.dateYearInferred};if(hasPositiveNumber(item.odometer)&&!ensureOdometerEntryValid({vehicleId:item.vehicleId,date:item.date,odometer:item.odometer,kind:'maintenance',id:item.id}))return;upsert(state.maintenance,item);if(hasPositiveNumber(item.odometer))activeVehicle().odometer=Math.max(activeVehicle().odometer,item.odometer);let reminder=state.reminders.find(r=>r.sourceType==='maintenance'&&r.sourceId===item.id);if(item.nextKm||item.nextDate){if(!reminder){reminder={id:uid(),vehicleId:state.activeVehicleId};state.reminders.push(reminder);}Object.assign(reminder,{title:item.items,category:item.type,targetKm:item.nextKm,targetDate:item.nextDate,status:'active',notes:'由維修工單自動建立',sourceType:'maintenance',sourceId:item.id});}else if(reminder){reminder.status='done';}closeModal();renderAll();toast('維修保養工單已儲存');}});
  }
  function openMaintenanceDetail(id){
    const row=state.maintenance.find(x=>x.id===id);if(!row)return;
    $('#modalEyebrow').textContent='維修保養工單明細';
    $('#modalTitle').textContent=`${row.date}｜${row.vendor||'未填維修廠'}`;
    const form=$('#modalForm');
    const details=Array.isArray(row.details)?row.details:[];
    const detailRows=details.map((d,i)=>`<tr><td>${i+1}</td><td><span class="badge blue">${esc(d.category||'項目')}</span></td><td>${esc(d.name||'')}</td><td>${num(d.qty??1,Number.isInteger(Number(d.qty))?0:1)}</td><td>${money(d.unitPrice||0)}</td><td>${money(d.amount||0)}</td><td>${esc(d.note||'')}</td></tr>`).join('');
    form.innerHTML=`<div class="maintenance-detail full"><div class="maintenance-detail-meta"><span><b>工單編號</b>${esc(row.workOrder||'未提供')}</span><span><b>進廠日期</b>${esc(row.date)}</span><span><b>印表日期</b>${esc(row.invoiceDate||'未提供')}</span><span><b>當時里程</b>${maintenanceOdometerText(row.odometer)}</span></div><div class="table-scroll"><table class="data-table maintenance-detail-table"><thead><tr><th>#</th><th>分類</th><th>項目</th><th>數量</th><th>單價</th><th>金額</th><th>說明</th></tr></thead><tbody>${detailRows||'<tr><td colspan="7" class="empty">沒有逐項明細</td></tr>'}</tbody></table></div><div class="maintenance-detail-total"><span>零件／用品 ${money(row.parts)}</span><span>工資 ${money(row.labor)}</span><strong>合計 ${money(row.total)}</strong></div>${row.notes?`<div class="maintenance-detail-note">${esc(row.notes)}</div>`:''}${row.attachment?`<a class="btn btn-secondary attachment-link" href="${encodeURI(row.attachment)}" target="_blank" rel="noopener">開啟原始單據</a>`:''}</div><div class="modal-actions"><button type="button" class="btn btn-secondary close-modal">關閉</button></div>`;
    form.onsubmit=e=>e.preventDefault();$('#modalBackdrop').hidden=false;
  }

  function openReminderModal(id=null){
    const row=id?state.reminders.find(x=>x.id===id):null;
    openModal({eyebrow:'保養提醒',title:row?'編輯提醒':'新增提醒',submitText:'儲存提醒',fields:[['title','提醒名稱','text',row?.title??'',true],['category','分類','select',row?.category||'定期保養',true,['定期保養','輪胎','保險','驗車','稅費','電瓶','煞車','其他']],['targetKm','目標里程','number',row?.targetKm??'',false],['targetDate','目標日期','date',row?.targetDate??'',false],['notes','說明','textarea',row?.notes??'',false]],onSubmit:data=>{upsert(state.reminders,{id:row?.id||uid(),vehicleId:state.activeVehicleId,title:data.title,category:data.category,targetKm:data.targetKm?+data.targetKm:null,targetDate:data.targetDate||null,status:'active',notes:data.notes,sourceType:row?.sourceType||'',sourceId:row?.sourceId||''});closeModal();renderAll();toast('提醒已儲存');}});
  }

  function createNextObligation(item){
    if(!item?.dueDate||item.type==='其他')return null;
    const vehicle=vehicleById(item.vehicleId);
    const inspectionMonths=item.type==='驗車'?inspectionIntervalMonths(vehicle,item.dueDate):null;
    if(item.type==='驗車'&&inspectionMonths==null)return null;
    const nextDueDate=item.type==='驗車'?addMonths(item.dueDate,inspectionMonths):addYears(item.dueDate,1);
    const existing=(state.obligations||[]).find(o=>o.parentId===item.id||(o.vehicleId===item.vehicleId&&o.type===item.type&&o.dueDate===nextDueDate));
    if(existing)return existing;
    const next={...item,id:uid(),parentId:item.id,dueDate:nextDueDate,periodStart:item.type==='驗車'?addMonths(item.periodStart,inspectionMonths):addYears(item.periodStart,1),periodEnd:item.type==='驗車'?addMonths(item.periodEnd,inspectionMonths):addYears(item.periodEnd,1),paidDate:'',status:'待繳',estimatedPaid:false,referenceNo:'',autoKey:'',notes:`由上一期 ${item.type} 紀錄自動建立${item.notes?`｜${item.notes}`:''}`};
    state.obligations.push(next);syncObligationReminder(next);syncVehicleDueDates(next.vehicleId);return next;
  }
  function markObligationPaid(item){
    if(!item)return;
    item.status='已繳';item.estimatedPaid=false;item.paidDate=item.paidDate||today();syncObligationReminder(item);syncVehicleDueDates(item.vehicleId);
    const recurring=['保險','強制險','任意險','牌照稅','燃料使用費','公路養管費','驗車'].includes(item.type);
    let next=null;
    const periodText=item.type==='驗車'?(inspectionIntervalMonths(vehicleById(item.vehicleId),item.dueDate)===6?'下一次半年檢驗':'下一次年度檢驗'):'下一年度';
    if(recurring&&confirm(`「${item.type}」已設為已繳。是否自動建立${periodText}待辦紀錄？`)) next=createNextObligation(item);
    renderAll();toast(next?`${item.type}已繳，並建立下一期紀錄`:`${item.type}已標記為已繳`);
  }
  function deleteObligation(item){
    if(!item)return;
    const linked=state.reminders.find(r=>r.sourceType==='obligation'&&r.sourceId===item.id);if(linked)linked.status='done';
    state.obligations=state.obligations.filter(x=>x.id!==item.id);syncVehicleDueDates(item.vehicleId);renderAll();toast('到期／繳費紀錄已刪除');
  }
  function openObligationModal(id=null){
    const row=id?(state.obligations||[]).find(x=>x.id===id):null;
    openModal({eyebrow:'稅金／保險／驗車',title:row?'編輯到期與繳費紀錄':'新增到期與繳費紀錄',submitText:'儲存紀錄',fields:[
      ['type','項目類型','select',row?.type||'強制險',true,['保險','強制險','任意險','牌照稅','公路養管費','燃料使用費','驗車','其他']],
      ['provider','承辦單位／保險公司','text',row?.provider??'',false],
      ['periodStart','保障／計費起日','date',row?.periodStart??'',false],
      ['periodEnd','保障／計費迄日','date',row?.periodEnd??'',false],
      ['dueDate','到期／應繳日期','date',row?.dueDate??'',true],
      ['amount','金額','number',row?.amount??0,false],
      ['status','繳納狀態','select',row?.status||'待繳',true,['待確認','待繳','已繳','免繳']],
      ['paidDate','實際繳納日期','date',row?.paidDate??'',false],
      ['referenceNo','保單號／繳款單號','text',row?.referenceNo??'',false],
      ['notes','備註','textarea',row?.notes??'',false]
    ],onSubmit:data=>{
      const item={id:row?.id||uid(),vehicleId:state.activeVehicleId,type:data.type,provider:data.provider,periodStart:data.periodStart||'',periodEnd:data.periodEnd||'',dueDate:data.dueDate||'',amount:+data.amount||0,status:data.status,paidDate:data.status==='已繳'?(data.paidDate||today()):'',referenceNo:data.referenceNo,notes:data.notes,parentId:row?.parentId||'',estimatedPaid:false,autoGenerated:row?.autoGenerated||false,autoKey:row?.autoKey||''};
      state.obligations ||= [];upsert(state.obligations,item);syncObligationReminder(item);syncVehicleDueDates(item.vehicleId);closeModal();renderAll();toast('稅金／保險／驗車紀錄已儲存');
    }});
  }

  function openVehicleModal(prefill=null){
    const base = prefill || {name:'', plate:'', year:new Date().getFullYear(), manufactureDate:'', engineCc:null, fuelType:'95無鉛', usage:'個人／家庭', odometer:0, maintenanceMode:'', serviceKm:null, serviceMonths:null, insuranceDate:'', inspectionDate:'', fuelTankCapacity:null, reserveLiters:null, benchmarkEfficiency:null, efficiencyReference:'', notes:''};
    openModal({eyebrow:'車輛主檔',title:'新增車輛',submitText:'建立車輛',fields:[
      ['name','車輛名稱','text',base.name,true],['plate','車牌號碼','text',base.plate,false],['year','年份','number',base.year||'',false],['manufactureDate','製造年月','month',base.manufactureDate||'',false],['engineCc','排氣量（CC）','number',base.engineCc??'',false],['fuelType','燃料種類','select',base.fuelType||'',false,[['','尚未設定'],'汽油（油品未註明）','92無鉛','95無鉛','98無鉛','柴油','油電','電動','其他']],['usage','車輛用途','select',base.usage||'',false,[['','尚未設定'],'個人／家庭','牧場公務','公司公務','混合使用']],['odometer','目前里程','number',base.odometer||0,true],['maintenanceMode','保養方式','select',base.maintenanceMode||'',false,[['','尚未設定'],'不定期保養','定期保養']],['serviceKm','定期保養里程','number',base.serviceKm??'',false],['serviceMonths','定期保養月數','number',base.serviceMonths??'',false],['fuelTankCapacity','油箱容量（L）','number',base.fuelTankCapacity??'',false],['reserveLiters','安全預留油量（L）','number',base.reserveLiters??'',false],['benchmarkEfficiency','車型參考油耗（km/L）','number',base.benchmarkEfficiency??'',false],['efficiencyReference','參考資料說明','text',base.efficiencyReference||'',false],['notes','備註','textarea',base.notes||'',false]
    ],onSubmit:data=>{
      const item={id:uid(),name:data.name,plate:isLexusVehicleName(data.name)?maskPlateValue(data.plate):data.plate,year:+data.year||null,manufactureDate:data.manufactureDate||'',engineCc:nullableNumber(data.engineCc),fuelType:data.fuelType,usage:data.usage,odometer:+data.odometer||0,maintenanceMode:data.maintenanceMode||'',serviceKm:nullableNumber(data.serviceKm),serviceMonths:nullableNumber(data.serviceMonths),insuranceDate:'',inspectionDate:'',fuelTankCapacity:nullableNumber(data.fuelTankCapacity),reserveLiters:nullableNumber(data.reserveLiters),benchmarkEfficiency:nullableNumber(data.benchmarkEfficiency),efficiencyReference:data.efficiencyReference||'',notes:data.notes||''};
      state.vehicles.push(item);
      state.activeVehicleId=item.id;
      closeModal();
      renderAll();
      toast('新車輛已建立');
    }});
  }

  function saveActiveVehicle(){
    const f=$('#vehicleForm');
    const d=Object.fromEntries(new FormData(f).entries());const odometer=+d.odometer||0;
    if(!ensureOdometerEntryValid({vehicleId:state.activeVehicleId,date:today(),odometer,kind:'vehicle',id:state.activeVehicleId}))return;
    Object.assign(activeVehicle(),{name:d.name,plate:isLexusVehicleName(d.name)?maskPlateValue(d.plate):d.plate,year:+d.year||null,manufactureDate:d.manufactureDate||'',engineCc:nullableNumber(d.engineCc),fuelType:d.fuelType,usage:d.usage,odometer,maintenanceMode:d.maintenanceMode||'',serviceKm:nullableNumber(d.serviceKm),serviceMonths:nullableNumber(d.serviceMonths),fuelTankCapacity:nullableNumber(d.fuelTankCapacity),reserveLiters:nullableNumber(d.reserveLiters),benchmarkEfficiency:nullableNumber(d.benchmarkEfficiency),efficiencyReference:d.efficiencyReference||'',notes:d.notes,isDemo:false});syncVehicleDueDates(state.activeVehicleId);
    renderAll();
    toast('車輛主檔已儲存');
  }

  function deleteActiveVehicle(){
    if(state.vehicles.length<=1) return toast('至少需保留一台車，無法刪除最後一台。','error');
    const current=activeVehicle();const counts={fuel:state.fuel.filter(x=>x.vehicleId===current.id).length,maint:state.maintenance.filter(x=>x.vehicleId===current.id).length,rem:state.reminders.filter(x=>x.vehicleId===current.id).length,obl:(state.obligations||[]).filter(x=>x.vehicleId===current.id).length,mileage:(state.mileageLogs||[]).filter(x=>x.vehicleId===current.id).length};
    if(!confirm(`刪除「${current.name}」會同時刪除 ${counts.fuel} 筆加油、${counts.maint} 筆保養、${counts.rem} 筆提醒、${counts.obl} 筆稅費與 ${counts.mileage} 筆手動里程。確定繼續？`))return;
    const expected=current.plate||current.name;const typed=prompt(`請輸入「${expected}」確認永久刪除：`);if(typed!==expected)return toast('確認文字不符，已取消刪除。','error');
    const removeId=current.id;state.vehicles=state.vehicles.filter(v=>v.id!==removeId);state.fuel=state.fuel.filter(x=>x.vehicleId!==removeId);state.maintenance=state.maintenance.filter(x=>x.vehicleId!==removeId);state.reminders=state.reminders.filter(x=>x.vehicleId!==removeId);state.obligations=(state.obligations||[]).filter(x=>x.vehicleId!==removeId);state.mileageLogs=(state.mileageLogs||[]).filter(x=>x.vehicleId!==removeId);state.partInspections=(state.partInspections||[]).filter(x=>x.vehicleId!==removeId);state.activeVehicleId=state.vehicles[0]?.id||null;renderAll();toast('車輛及其關聯資料已刪除');
  }
  function isCoarseTouchInput(){
    try{return !!(navigator.maxTouchPoints>0 || window.matchMedia?.('(hover: none) and (pointer: coarse)').matches);}catch{return Number(navigator.maxTouchPoints||0)>0;}
  }
  function openModal({eyebrow,title,submitText,fields,onSubmit}){
    $('#modalEyebrow').textContent=eyebrow;$('#modalTitle').textContent=title;const form=$('#modalForm');
    form.innerHTML=fields.map(f=>{const [name,label,type,value,required,options]=f;const req=required?'required':'';let control='';if(type==='select'){control=`<select name="${name}" ${req}>${options.map(o=>Array.isArray(o)?`<option value="${esc(o[0])}" ${String(value)===String(o[0])?'selected':''}>${esc(o[1])}</option>`:`<option ${String(value)===String(o)?'selected':''}>${esc(o)}</option>`).join('')}</select>`}else if(type==='textarea'){control=`<textarea name="${name}" rows="3" inputmode="text" ${req}>${esc(value)}</textarea>`}else{const inputMode=type==='number'?'inputmode="decimal"':type==='text'||type==='search'||type==='url'?'inputmode="text"':'';control=`<input name="${name}" type="${type}" value="${esc(value)}" ${inputMode} ${req} ${type==='number'?'step="0.01" min="0"':''}/>`}return `<label class="${type==='textarea'?'full':''}">${label}${control}</label>`}).join('')+`<div class="modal-actions"><button type="button" class="btn btn-secondary close-modal">取消</button><button type="submit" class="btn btn-teal">${submitText}</button></div>`;
    form.onsubmit=e=>{e.preventDefault();onSubmit(Object.fromEntries(new FormData(form).entries()));};
    $('#modalBackdrop').hidden=false;
    // iPhone/iPad must not receive programmatic focus after a modal opens.
    // iOS may mark the field focused without presenting the software keyboard,
    // then subsequent taps appear to do nothing. On touch devices the user tap
    // is the only focus trigger; desktop keeps the convenience autofocus.
    if(!isCoarseTouchInput()) setTimeout(()=>form.querySelector('input,select,textarea')?.focus(),0);
    else { const active=document.activeElement; if(active?.closest?.('#modalForm')) active.blur(); }
  }
  function closeModal(){ $('#modalBackdrop').hidden=true;$('#modalForm').onsubmit=null; }
  function upsert(arr,item){const i=arr.findIndex(x=>x.id===item.id);if(i>=0)arr[i]=item;else arr.push(item);}
  function toast(msg,type='ok',auto=true){const t=document.createElement('div');t.className=`toast ${type==='error'?'error':''}`;t.textContent=msg;$('#toastStack').append(t);if(auto)setTimeout(()=>t.remove(),3200);return false;}
  function reportTable(headers, rows, emptyText='尚無資料'){
    const cellHtml=cell=>{const raw=String(cell??'');const plain=raw.replace(/<[^>]+>/g,'').trim();const nowrap=/^(\$|\d{4}-\d{2}-\d{2}|\d{4}-\d{2}|[\d,.]+\s?(km\/L|km|L|元)?$|是$|否$|-)$/.test(plain);return `<td class="${nowrap?'nowrap':''}">${raw}</td>`;};
    const body=rows.length?rows.map(row=>`<tr>${row.map(cellHtml).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}" class="empty-cell">${esc(emptyText)}</td></tr>`;
    return `<div class="table-wrap ${headers.length>=8?'wide-table':''}"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
  }
  function reportSection(title, content, className=''){
    return `<section class="report-section ${className}"><h2>${esc(title)}</h2>${content}</section>`;
  }
  function reportSummaryCards(items){
    return `<div class="summary-grid">${items.map(x=>`<div class="summary-card"><small>${esc(x[0])}</small><strong>${x[1]}</strong>${x[2]?`<span>${esc(x[2])}</span>`:''}</div>`).join('')}</div>`;
  }
  function reportCss(orientation='landscape'){return `
    @page{size:A4 ${orientation};margin:9mm 9mm 12mm}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;color:#172b3a;background:#fff;font-family:"Microsoft JhengHei","Noto Sans TC",Arial,sans-serif;font-size:9.6pt;line-height:1.38}
    body{print-color-adjust:exact;-webkit-print-color-adjust:exact}
    .report{max-width:100%;margin:0 auto}
    .cover{border:2px solid #1b6aa8;border-radius:10px;padding:13px 16px;margin-bottom:11px;background:linear-gradient(135deg,#eef7ff,#f8fcff);break-inside:avoid}
    .cover h1{margin:0;color:#123f63;font-size:19pt}.cover .subtitle{margin-top:4px;color:#4c687d}.cover .meta{margin-top:8px;display:flex;gap:14px;flex-wrap:wrap;color:#36576e;font-size:8.8pt}
    h2{font-size:12.5pt;color:#164f78;margin:0 0 6px;padding-bottom:4px;border-bottom:2px solid #cce3f3}
    h3{font-size:10.5pt;color:#214e6b;margin:9px 0 5px}
    .report-section{margin:0 0 10px;break-inside:auto;orphans:3;widows:3}.vehicle-block{break-before:page}.vehicle-block:first-child{break-before:auto}
    .summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:9px}
    .summary-card{border:1px solid #b9d4e7;border-radius:7px;padding:7px;background:#f4f9fd;min-height:54px;break-inside:avoid}
    .summary-card small{display:block;color:#527087;font-size:7.8pt}.summary-card strong{display:block;color:#102f45;font-size:12pt;margin-top:2px;overflow-wrap:anywhere}.summary-card span{display:block;color:#58758a;font-size:7.4pt;margin-top:1px}
    .info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:8px}.info-item{border:1px solid #d3e3ee;border-radius:6px;padding:6px;background:#fbfdff}.info-item b{display:block;color:#4b687d;font-size:7.6pt}.info-item span{display:block;color:#172b3a;font-weight:700;margin-top:1px}
    .table-wrap{width:100%;overflow:visible;margin-bottom:5px}table{width:100%;border-collapse:collapse;font-size:7.7pt;table-layout:auto}thead{display:table-header-group}tfoot{display:table-footer-group}tr{break-inside:avoid}th,td{border:1px solid #bdd2e0;padding:3.5px 4px;vertical-align:top;word-break:normal;overflow-wrap:anywhere}th{background:#dcecf7;color:#173f5c;font-weight:800;text-align:left;white-space:nowrap}td.nowrap{white-space:nowrap;overflow-wrap:normal}.wide-table table{font-size:7.2pt}.wide-table th,.wide-table td{padding:3px 3.5px}tbody tr:nth-child(even){background:#f7fafc}.empty-cell{text-align:center;color:#6e8291;padding:10px}
    .note{border-left:4px solid #2d87bd;background:#eef7fc;padding:6px 8px;margin:6px 0;color:#385b72}.warning{border-color:#d39721;background:#fff7e5}.danger{border-color:#c84242;background:#fff0f0}
    .page-break{break-before:page}.no-break{break-inside:avoid}
    .footer{margin-top:10px;padding-top:6px;border-top:1px solid #c8d8e4;color:#6a7e8e;font-size:7.5pt;text-align:center}
    @media(max-width:700px){.summary-grid{grid-template-columns:repeat(2,1fr)}.info-grid{grid-template-columns:repeat(2,1fr)}}
    .service-shop-report{font-size:10.5pt;line-height:1.42}
    .service-shop-report .cover{padding:12px 15px;margin-bottom:9px}
    .service-shop-report .cover h1{font-size:21pt}
    .service-shop-report .cover .subtitle{font-size:10.5pt}
    .service-shop-report .cover .meta{font-size:9.5pt;gap:18px;white-space:nowrap}
    .service-shop-report h2{font-size:13.5pt;margin-bottom:5px}
    .service-shop-report .note{font-size:9.7pt;padding:7px 9px}
    .service-shop-report .summary-grid{grid-template-columns:repeat(4,1fr);gap:7px}
    .service-shop-report .summary-card{padding:8px;min-height:58px}
    .service-shop-report .summary-card small{font-size:8.5pt}.service-shop-report .summary-card strong{font-size:13pt}.service-shop-report .summary-card span{font-size:8.2pt}
    .service-shop-report .info-item b{font-size:8.5pt}.service-shop-report .info-item span{font-size:9.8pt}
    .service-shop-report table{font-size:9.2pt;table-layout:auto}
    .service-shop-report .wide-table table{font-size:8.6pt}
    .service-shop-report th,.service-shop-report td{padding:4.2px 4.8px;white-space:nowrap;overflow-wrap:normal;vertical-align:middle}
    .service-shop-report .wrap-cell{display:block;white-space:normal;min-width:35mm;line-height:1.35}
    .service-shop-report .footer{font-size:8pt}
    @media print{.screen-only{display:none!important}a{color:inherit;text-decoration:none}}
  `;}
  function openPrintReport(title, bodyHtml,{orientation='landscape'}={}){
    const win=window.open('','_blank');
    if(!win){toast('瀏覽器封鎖了列印視窗，請允許此頁開啟彈出視窗。','error');return;}
    const generated=new Date().toLocaleString('zh-TW',{hour12:false});
    win.document.open();
    win.document.write(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${reportCss(orientation)}</style></head><body><main class="report">${bodyHtml}<div class="footer">車輛維修保養與油耗管理中心 V5.6.6｜產生時間：${esc(generated)}｜列印時可選擇「另存為 PDF」</div></main><script>window.addEventListener('load',()=>setTimeout(()=>{window.focus();window.print();},350));<\/script></body></html>`);
    win.document.close();
  }
  function maintenanceEvaluationReportHtml(vehicleId){
    const ev=maintenanceEvaluationForVehicle(vehicleId,'5');
    const summary=reportSummaryCards([
      ['車齡',ev.age.label,ev.age.stage],
      ['年均行駛里程',ev.mileage.value!=null?`${num(ev.mileage.value)} km`:'資料不足',ev.mileage.quality],
      ['正常年度預算',`${money(ev.budget.low)}～${money(ev.budget.high)}`],
      ['日曆年均實際支出',ev.total?money(ev.actualAvg):'$0',ev.windowInfo.label],
      ['有支出年度平均',ev.spendingYears?money(ev.activeYearAvg):'資料不足'],
      ['排除一次性大修後年均',money(ev.normalizedAvg)],
      ['必要支出占比',`${num(ev.essentialRatio*100,0)}%`],
      ['維修效益評分',ev.finalScore!=null?`${ev.finalScore} 分｜${ev.grade.label}`:'資料不足']
    ]);
    const categoryRows=Object.entries(MAINTENANCE_BENEFIT_META).map(([key,meta])=>[esc(meta.label),money(ev.categoryTotals[key]||0),`${num((ev.categoryTotals[key]||0)/Math.max(ev.total,1)*100,0)}%`]);
    const annualRows=ev.years.slice().reverse().map(y=>[String(y.year),y.age!=null?`${y.age} 年`:'-',String(y.items.length),money(y.preventive),money(y.repair),money(y.major),money(y.total)]);
    const orderRows=ev.assessments.slice().reverse().map(x=>[esc(x.order.date),esc(x.order.items),money(x.total),esc(MAINTENANCE_BENEFIT_META[x.dominant].label),esc(x.necessity),x.oneOff?'是':'否',esc(x.explanation)]);
    const conclusions=`<div class="info-grid"><div class="note"><strong>正向判斷</strong><br>${ev.strengths.map(esc).join('<br>')||'目前沒有足夠資料。'}</div><div class="note warning"><strong>注意事項</strong><br>${ev.warnings.map(esc).join('<br>')||'目前沒有明顯異常。'}</div></div>`;
    return `${summary}<div class="note"><strong>預算基準：</strong>${esc(ev.budget.reference)}｜一次性大修門檻 ${money(ev.budget.threshold)}。此為規劃估算，不是官方定價或維修必要性的最終判定。</div>${reportTable(['效益分類','金額','占比'],categoryRows)}${reportTable(['年度','車齡','工單數','預防保養','故障／修復','一次性大修','年度總額'],annualRows)}${orderRows.length?reportTable(['日期','工單內容','金額','主要效益','必要性','一次性','效益說明'],orderRows):''}${conclusions}`;
  }


  function vehicleReportHtml(vehicleId,{pageBreak=false,includeAllReminders=true}={}){
    const v=vehicleById(vehicleId);const m=metricsForVehicle(vehicleId);const pf=fuelPerformanceForVehicle(vehicleId,'5');const year=today().slice(0,4);const mileage=calculateYearDistance(vehicleId,year);
    const fuelRows=computeFuelRowsForVehicle(vehicleId).slice().reverse();
    const maintRows=vmById(vehicleId);
    const obligationRows=voById(vehicleId);
    const reminderRows=(state.reminders||[]).filter(x=>x.vehicleId===vehicleId&&(includeAllReminders||x.status!=='done')).sort((a,b)=>(a.targetDate||'9999-12-31').localeCompare(b.targetDate||'9999-12-31'));
    const mileageRows=mileagePointsForVehicle(vehicleId).slice().reverse();
    const summary=reportSummaryCards([
      ['目前里程',`${num(v.odometer)} km`],['近期加權油耗',pf.avg?`${num(pf.avg,2)} km/L`:'資料不足'],['油耗評價',pf.grade.label,pf.ratio?`參考值達成率 ${num(pf.ratio*100,0)}%`:pf.quality],['安全續航',pf.safeRange?`${num(pf.safeRange)} km`:'資料不足'],['本月油費',money(m.fuelMonth)],['本年度燃油支出',money(m.fuelYear)],['本年度維修費',money(m.maintYear)],['本年度稅金保險驗車',money(obligationYearTotal(vehicleId,year))],['年度行駛里程',mileage.distance!=null?`${num(mileage.distance)} km`:'資料不足',mileage.quality],['最近提醒',nextReminderTextForVehicle(vehicleId)]
    ]);
    const basic=`<div class="info-grid"><div class="info-item"><b>車輛名稱</b><span>${esc(v.name)}</span></div><div class="info-item"><b>車牌號碼</b><span>${esc(v.plate||'未填')}</span></div><div class="info-item"><b>製造年月</b><span>${esc(v.manufactureDate||v.year||'未填')}</span></div><div class="info-item"><b>排氣量</b><span>${v.engineCc?`${num(v.engineCc)} CC`:'未填'}</span></div><div class="info-item"><b>燃料種類</b><span>${esc(v.fuelType||'未填')}</span></div><div class="info-item"><b>車輛用途</b><span>${esc(v.usage||'未填')}</span></div><div class="info-item"><b>保養方式</b><span>${esc(v.maintenanceMode||'未設定')}</span></div><div class="info-item"><b>定期保養週期</b><span>${v.serviceKm||v.serviceMonths?`${v.serviceKm?`${num(v.serviceKm)} km`:''}${v.serviceKm&&v.serviceMonths?'／':''}${v.serviceMonths?`${num(v.serviceMonths)} 個月`:''}`:'不適用／未設定'}</span></div><div class="info-item"><b>油箱容量</b><span>${v.fuelTankCapacity?`${num(v.fuelTankCapacity,1)} L`:'未設定'}</span></div><div class="info-item"><b>安全預留油量</b><span>${v.reserveLiters!=null?`${num(v.reserveLiters,1)} L`:'未設定'}</span></div><div class="info-item"><b>車型參考油耗</b><span>${v.benchmarkEfficiency?`${num(v.benchmarkEfficiency,1)} km/L`:'未設定'}</span></div><div class="info-item"><b>評估資料品質</b><span>${esc(pf.quality)}</span></div></div>${v.notes?`<div class="note"><strong>車輛備註：</strong>${esc(v.notes)}</div>`:''}`;
    const performanceReport=`${reportSummaryCards([['近期加權油耗',pf.avg?`${num(pf.avg,2)} km/L`:'資料不足'],['參考油耗',pf.benchmark?`${num(pf.benchmark,2)} km/L`:'未設定'],['理論滿油續航',pf.fullRange?`${num(pf.fullRange)} km`:'資料不足'],['安全可用續航',pf.safeRange?`${num(pf.safeRange)} km`:'資料不足'],['保守建議續航',pf.conservativeRange?`${num(pf.conservativeRange)} km`:'資料不足'],['每100公里油費',pf.costPer100Km!=null?money(pf.costPer100Km):'資料不足']])}<div class="note"><strong>整體判斷：</strong>${esc(pf.avg&&pf.benchmark?`近期油耗為參考值的 ${num(pf.ratio*100,0)}%，評價為「${pf.grade.label}」。`:'有效週期或參考值不足，暫時無法評等。')}</div>${reportTable(['油耗與續航優點','需要注意的地方'],[[performanceStrengths(pf).map(esc).join('<br>'),performanceWeaknesses(pf).map(esc).join('<br>')]])}`;
    const fuelTable=reportTable(['日期','里程','區間公里','油品','公升','有效單價','實付','加滿','油耗','每公里油費'],fuelRows.map(x=>[`${esc(x.date)}${x.dateYearInferred?'（年份回推）':''}`,fuelOdometerText(x.odometer,x.odometerEstimated),fuelDistanceText(x),esc(x.fuelType),fuelLitersText(x.liters,2,x.litersEstimated),fuelUnitPriceText(x.unitPrice,2,x.unitPriceEstimated),`${money(x.amount)}${fuelDiscountAmount(x)?`（折價約 ${money(fuelDiscountAmount(x))}）`:''}`,fullTankText(x.fullTank,x.fullTankEstimated),fuelEfficiencyDisplay(x),x.costPerKm?`${money2(x.costPerKm)}/km`:'-']));
    const maintTable=reportTable(['日期','里程','類型','維修廠','項目','零件','工資','折扣','總金額','下次提醒'],maintRows.map(x=>[esc(x.date),maintenanceOdometerText(x.odometer),esc(x.type),esc(x.vendor||'-'),esc(x.items),money(x.parts),money(x.labor),money(x.discount),money(x.total),x.nextKm?`${num(x.nextKm)} km`:esc(x.nextDate||'-')]));
    const maintDetailHtml=maintRows.filter(x=>x.details?.length).map(x=>`<div class="no-break"><h3>${esc(x.date)}｜${esc(x.vendor||'未填維修廠')}｜${esc(x.workOrder||'無工單編號')}</h3>${reportTable(['分類','項目','數量','單價','金額','說明'],x.details.map(d=>[esc(d.category||''),esc(d.name||''),num(d.qty??1,Number.isInteger(Number(d.qty))?0:1),money(d.unitPrice||0),money(d.amount||0),esc(d.note||'')]))}</div>`).join('');
    const obligationTable=reportTable(['類型','承辦單位／保險公司','期間','到期／應繳日','金額','繳納日','狀態','保單／單號','備註'],obligationRows.map(x=>[esc(x.type),esc(x.provider||'-'),esc([x.periodStart,x.periodEnd].filter(Boolean).join(' ～ ')||'-'),esc(x.dueDate||'-'),money(x.amount),esc(x.paidDate||'-'),esc(x.estimatedPaid?'推定已繳':x.status),esc(x.referenceNo||'-'),esc(x.notes||'-')]));
    const reminderTable=reportTable(['提醒名稱','分類','目標里程','目標日期','狀態','說明'],reminderRows.map(x=>[esc(x.title),esc(x.category),x.targetKm?`${num(x.targetKm)} km`:'-',esc(x.targetDate||'-'),x.status==='done'?'已完成':'進行中',esc(x.notes||'-')]));
    const mileageTable=reportTable(['日期','里程','來源','說明'],mileageRows.map(x=>[esc(x.date),`${num(x.odometer)} km`,esc(x.source),esc(x.notes||'-')]));
    return `<article class="vehicle-block ${pageBreak?'page-break':''}"><div class="cover"><h1>${esc(v.name)} 車輛完整報告</h1><div class="subtitle">車牌：${esc(v.plate||'未填')}｜報告年度：${esc(year)} 年</div><div class="meta"><span>燃料：${esc(v.fuelType||'-')}</span><span>用途：${esc(v.usage||'-')}</span><span>目前里程：${num(v.odometer)} km</span></div></div>${v.isDemo?'<div class="note warning"><strong>示範資料：</strong>車牌、年份、費用、保險公司及部分里程為介面測試資料，請依實車修改。</div>':''}${summary}${reportSection('車輛基本資料',basic,'no-break')}${reportSection('油耗與續航力評估',performanceReport,'no-break')}${reportSection('車齡與維修支出效益評估',maintenanceEvaluationReportHtml(vehicleId))}${reportSection('零件與耗材汰換標準評估',partAssessmentReportHtml(vehicleId))}${reportSection('加油與油耗紀錄',fuelTable)}${reportSection('維修保養紀錄',maintTable)}${maintDetailHtml?reportSection('維修保養逐項明細',maintDetailHtml):''}${reportSection('稅金、保險與驗車紀錄',obligationTable)}${reportSection('提醒紀錄',reminderTable)}${reportSection('里程歷史紀錄',`<div class="note ${mileage.anomalies?'warning':''}">${esc(mileage.message)}</div>${mileageTable}`,'page-break')}</article>`;
  }
  function fleetReportHtml(){
    const year=today().slice(0,4);const list=state.vehicles.map(v=>({v,m:metricsForVehicle(v.id),mileage:calculateYearDistance(v.id,year),due:nextReminderTextForVehicle(v.id)}));
    const totalFuel=list.reduce((s,x)=>s+x.m.fuelYear,0),totalMaint=list.reduce((s,x)=>s+x.m.maintYear,0),totalObligation=list.reduce((s,x)=>s+obligationYearTotal(x.v.id,year),0);
    const cycles=list.flatMap(x=>x.m.valid).filter(x=>x.distance>0&&x.cycleLiters>0);const totalDistance=cycles.reduce((s,x)=>s+Number(x.distance||0),0);const totalLiters=cycles.reduce((s,x)=>s+Number(x.cycleLiters||0),0);const avgEff=totalLiters>0?totalDistance/totalLiters:0;
    const dueItems=(state.obligations||[]).filter(x=>['待繳','待確認'].includes(x.status)).sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999'));
    const summary=reportSummaryCards([['車輛總數',`${state.vehicles.length} 台`],['年度燃油支出',money(totalFuel)],['年度維修費',money(totalMaint)],['年度稅金保險驗車',money(totalObligation)],['全車總支出',money(totalFuel+totalMaint+totalObligation)],['全車平均油耗',avgEff?`${num(avgEff,2)} km/L`:'資料不足'],['待繳／到期事項',`${dueItems.length} 項`],['報告年度',`${year} 年`]]);
    const fleetTable=reportTable(['車輛','車牌','目前里程','最近油耗','本月油費','年度燃油','年度維修','年度固定支出','年度里程','最近提醒'],list.map(x=>[esc(x.v.name),esc(x.v.plate||'-'),`${num(x.v.odometer)} km`,x.m.latestEff?`${num(x.m.latestEff,2)} km/L`:'-',money(x.m.fuelMonth),money(x.m.fuelYear),money(x.m.maintYear),money(obligationYearTotal(x.v.id,year)),x.mileage.distance!=null?`${num(x.mileage.distance)} km`:'資料不足',esc(x.due)]));
    const dueTable=reportTable(['車輛','類型','承辦單位','到期日','金額','剩餘狀態'],dueItems.map(x=>{const days=daysUntil(x.dueDate);return[esc(vehicleById(x.vehicleId).name),esc(x.type),esc(x.provider||'-'),esc(x.dueDate||'-'),money(x.amount),days==null?'未設定':days<0?`逾期 ${Math.abs(days)} 天`:days===0?'今天到期':`剩餘 ${days} 天`]}));
    return `<div class="cover"><h1>全部車輛總覽報告</h1><div class="subtitle">車輛維修保養、油耗、年度成本與到期事項比較</div><div class="meta"><span>報告年度：${year} 年</span><span>資料車輛：${state.vehicles.length} 台</span></div></div>${summary}${reportSection('全車比較總表',fleetTable)}${reportSection('全車待繳與近期到期事項',dueTable)}`;
  }
  function fullBackupReportHtml(){
    const cover=`<div class="cover"><h1>車輛管理完整資料列印存檔報告</h1><div class="subtitle">包含所有車輛主檔、加油、維修、稅金保險驗車、提醒及里程紀錄</div><div class="meta"><span>車輛總數：${state.vehicles.length} 台</span><span>加油紀錄：${state.fuel.length} 筆</span><span>維修紀錄：${state.maintenance.length} 筆</span><span>固定支出紀錄：${(state.obligations||[]).length} 筆</span></div></div><div class="note warning"><strong>備份用途說明：</strong>此 PDF 適合人工閱讀與列印存檔，無法匯回系統。需要可還原的資料備份，請同時下載 JSON 完整備份。</div>`;
    return cover+state.vehicles.map((v,i)=>vehicleReportHtml(v.id,{pageBreak:true,includeAllReminders:true})).join('');
  }
  function download(name,text,type='text/plain;charset=utf-8'){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);}
  function csv(rows){return '\ufeff'+rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\r\n');}

  function renderSearchResults(query){
    const box=$('#searchResults');const q=query.trim().toLowerCase();
    if(!q){box.hidden=true;box.innerHTML='';return;}
    const results=[];
    state.vehicles.filter(v=>`${v.name} ${v.plate||''} ${v.usage||''}`.toLowerCase().includes(q)).slice(0,3).forEach(v=>results.push({type:'vehicle',id:v.id,vehicleId:v.id,title:v.name,sub:`車輛｜${v.plate||'未填車牌'}`}));
    state.maintenance.filter(x=>`${x.workOrder||''} ${x.date||''} ${x.odometer??''} ${x.vendor||''} ${x.total??''} ${x.items||''} ${x.notes||''} ${(x.details||[]).map(d=>`${d.category||''} ${d.name||''} ${d.note||''}`).join(' ')}`.toLowerCase().includes(q)).slice(0,3).forEach(x=>results.push({type:'maintenance',id:x.id,vehicleId:x.vehicleId,title:x.items,sub:`維修保養｜${x.workOrder?`工單 ${x.workOrder}｜`:''}${x.date}｜${vehicleById(x.vehicleId).name}`}));
    state.fuel.filter(x=>`${x.date} ${x.odometer} ${x.fuelType} ${x.station}`.toLowerCase().includes(q)).slice(0,3).forEach(x=>results.push({type:'fuel',id:x.id,vehicleId:x.vehicleId,title:`${x.date} ${x.fuelType}`,sub:`加油｜${num(x.odometer)} km｜${vehicleById(x.vehicleId).name}`}));
    (state.obligations||[]).filter(x=>`${x.type} ${x.provider} ${x.referenceNo} ${x.notes}`.toLowerCase().includes(q)).slice(0,3).forEach(x=>results.push({type:'obligation',id:x.id,vehicleId:x.vehicleId,title:`${x.type}｜${x.provider||'未填承辦單位'}`,sub:`稅金保險驗車｜${x.dueDate||'未設定日期'}｜${vehicleById(x.vehicleId).name}`}));
    box.innerHTML=results.slice(0,8).map(r=>`<button class="search-result-item" data-search-type="${r.type}" data-search-id="${r.id}" data-search-vehicle="${r.vehicleId}" type="button"><strong>${esc(r.title)}</strong><small>${esc(r.sub)}</small></button>`).join('')||`<div class="search-empty">找不到符合「${esc(query)}」的資料</div>`;
    box.hidden=false;
  }
  function openSearchResult(type,id,vehicleId){
    state.activeVehicleId=vehicleId;renderAll();$('#searchResults').hidden=true;
    if(type==='vehicle'){switchView('dashboard');toast(`已切換到 ${activeVehicle().name}`);return;}
    if(type==='maintenance'){switchView('maintenance');const row=state.maintenance.find(x=>x.id===id);$('#maintenanceKeyword').value=row?.items||'';renderMaintenance();return;}
    if(type==='fuel'){switchView('fuel');toast('已切換至該車輛的加油紀錄');return;}
    if(type==='obligation'){switchView('obligations');const row=state.obligations.find(x=>x.id===id);$('#obligationKeyword').value=row?.provider||row?.type||'';renderObligations();}
  }

  function switchView(view){
    activeView=view;$$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${view}`));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===view));const labels={dashboard:'掌握里程、油耗、費用與保養週期',maintenance:'管理每一次進廠工單與下次提醒','maintenance-evaluation':'依車齡評估正常維修預算與實際支出效益',fuel:'記錄每一次加油並自動換算實際油耗','fuel-quality':'檢查估算、回推、異常油耗與待確認資料',efficiency:'評估油耗表現、安全續航與車輛優缺點',analysis:'比較年度支出與每公里成本',reminders:'日期與里程雙重提醒',automation:'自動評估、到期通知、離線運行與版本更新',sync:'dad與mom共用Google Sheets雲端資料庫與跨裝置同步',obligations:'管理每台車的稅金、保險、驗車與繳費期限',vehicle:'建立多台車並分別管理各自資訊與紀錄',export:'匯出報表、備份與還原資料'};$('#pageSubtitle').textContent=labels[view];window.scrollTo({top:0,behavior:'smooth'});if(innerWidth<720)$('#sidebar').classList.remove('mobile-open');
  }

  document.addEventListener('click',e=>{
    const themeOption=e.target.closest('[data-theme-value]');if(themeOption){updateAppearance({theme:themeOption.dataset.themeValue});return;}
    const fontOption=e.target.closest('[data-font-size-value]');if(fontOption){updateAppearance({fontSize:fontOption.dataset.fontSizeValue});return;}
    const searchResult=e.target.closest('[data-search-type]');if(searchResult)return openSearchResult(searchResult.dataset.searchType,searchResult.dataset.searchId,searchResult.dataset.searchVehicle);
    if(!e.target.closest('.search-wrap'))$('#searchResults').hidden=true;
    if(!e.target.closest('.appearance-wrap'))toggleAppearancePanel(false);
    const autoJump=e.target.closest('[data-auto-jump]');if(autoJump){const vehicleId=autoJump.dataset.autoVehicle;if(vehicleId)state.activeVehicleId=vehicleId;renderAll();return switchView(autoJump.dataset.autoJump);}
    const nav=e.target.closest('.nav-item');if(nav)return switchView(nav.dataset.view);
    const sv=e.target.closest('[data-select-vehicle]');if(sv){state.activeVehicleId=sv.dataset.selectVehicle;const target=sv.dataset.jump;renderAll();if(target)switchView(target);return;}
    const jump=e.target.closest('[data-jump]');if(jump)return switchView(jump.dataset.jump);
    if(e.target.closest('.close-modal'))return closeModal();
    const vmDetail=e.target.closest('[data-view-maint]');if(vmDetail)return openMaintenanceDetail(vmDetail.dataset.viewMaint);
    const em=e.target.closest('[data-edit-maint]');if(em)return openMaintenanceModal(em.dataset.editMaint);
    const dm=e.target.closest('[data-del-maint]');if(dm&&confirm('確定刪除這筆維修保養紀錄？')){createLocalSnapshot('刪除維修工單前');const id=dm.dataset.delMaint;state.maintenance=state.maintenance.filter(x=>x.id!==id);state.reminders.filter(r=>r.sourceType==='maintenance'&&r.sourceId===id).forEach(r=>r.status='done');renderAll();return;}
    const qFull=e.target.closest('[data-quality-full]');if(qFull){const row=state.fuel.find(x=>x.id===qFull.dataset.qualityFull);if(row){row.fullTank=true;row.fullTankEstimated=false;row.dataQualityStatus='confirmed';row.userConfirmed=true;row.dataQualityNotes='使用者確認本次為加滿';renderAll();toast('已確認為加滿紀錄');}return;}
    const qNotFull=e.target.closest('[data-quality-notfull]');if(qNotFull){const row=state.fuel.find(x=>x.id===qNotFull.dataset.qualityNotfull);if(row){row.fullTank=false;row.fullTankEstimated=false;row.dataQualityStatus='confirmed';row.userConfirmed=true;row.dataQualityNotes='使用者確認本次並非加滿';renderAll();toast('已確認為非加滿紀錄');}return;}
    const qConfirm=e.target.closest('[data-quality-confirm]');if(qConfirm){const row=state.fuel.find(x=>x.id===qConfirm.dataset.qualityConfirm);if(row){row.userConfirmed=true;row.dataQualityNotes='已由使用者人工確認估算／回推資料';renderAll();toast('已標記為人工確認');}return;}
    const unclassified=e.target.closest('[data-unclassified-resolve]');if(unclassified){const row=(state.unclassifiedRecords||[]).find(x=>x.id===unclassified.dataset.unclassifiedResolve);if(row){row.status='已處理';renderAll();toast('未歸類資料已標記為處理完成');}return;}
    const ef=e.target.closest('[data-edit-fuel]');if(ef)return openFuelModal(ef.dataset.editFuel);
    const df=e.target.closest('[data-del-fuel]');if(df&&confirm('確定刪除這筆加油紀錄？')){createLocalSnapshot('刪除加油紀錄前');state.fuel=state.fuel.filter(x=>x.id!==df.dataset.delFuel);renderAll();return;}
    const er=e.target.closest('[data-edit-reminder]');if(er)return openReminderModal(er.dataset.editReminder);
    const dr=e.target.closest('[data-del-reminder]');if(dr&&confirm('確定刪除這筆提醒？')){state.reminders=state.reminders.filter(x=>x.id!==dr.dataset.delReminder);renderAll();return;}
    const eo=e.target.closest('[data-edit-obligation]');if(eo)return openObligationModal(eo.dataset.editObligation);
    const po=e.target.closest('[data-pay-obligation]');if(po){markObligationPaid(state.obligations.find(x=>x.id===po.dataset.payObligation));return;}
    const doo=e.target.closest('[data-del-obligation]');if(doo&&confirm('確定刪除這筆稅金／保險／驗車紀錄？')){deleteObligation(state.obligations.find(x=>x.id===doo.dataset.delObligation));return;}
    const ageEdit=e.target.closest('[data-edit-age-profile]');if(ageEdit){openAgeProfileModal(ageEdit.dataset.editAgeProfile);return;}
    const partRecord=e.target.closest('[data-record-part]');if(partRecord){openPartRecordModal(partRecord.dataset.recordPart);return;}
    const partStandard=e.target.closest('[data-edit-part-standard]');if(partStandard){openPartStandardModal(partStandard.dataset.editPartStandard);return;}
    const ageSelect=e.target.closest('[data-select-profile-age]');if(ageSelect){const input=$('#ageSimulationAge');input.value=ageSelect.dataset.selectProfileAge;input.dataset.ready='1';renderAgeDatabaseSimulation();return;}
    const dml=e.target.closest('[data-del-mileage]');if(dml&&confirm('確定刪除這筆手動里程紀錄？')){state.mileageLogs=state.mileageLogs.filter(x=>x.id!==dml.dataset.delMileage);renderAll();return;}
  });

  $('#sidebarToggle').onclick=()=>innerWidth<720?$('#sidebar').classList.toggle('mobile-open'):document.body.classList.toggle('sidebar-collapsed');
  $('#mobileMenuButton').onclick=()=>$('#sidebar').classList.toggle('mobile-open');
  $('#collapseBtn').onclick=()=>document.body.classList.toggle('sidebar-collapsed');
  $('#vehicleSelect').onchange=e=>{state.activeVehicleId=e.target.value;renderAll();};
  $('#addFuelTop').onclick=$('#addFuelPage').onclick=()=>openFuelModal();
  $('#addMaintenanceTop').onclick=$('#addMaintenancePage').onclick=()=>openMaintenanceModal();
  $('#addReminder').onclick=()=>openReminderModal();
  $('#addObligation').onclick=()=>openObligationModal();
  $('#addMileageLog').onclick=()=>openMileageModal();
  $('#addVehicle').onclick=()=>openVehicleModal();
  $('#duplicateVehicle').onclick=()=>openVehicleModal({...activeVehicle(), name:`${activeVehicle().name}（副本）`, plate:''});
  $('#deleteVehicle').onclick=()=>deleteActiveVehicle();
  $('#appearanceButton').onclick=()=>toggleAppearancePanel();
  $('#closeAppearance').onclick=()=>toggleAppearancePanel(false);
  $('#highContrastToggle').onchange=e=>updateAppearance({highContrast:e.target.checked});
  $('#resetAppearance').onclick=()=>{appearanceSettings={...DEFAULT_APPEARANCE};applyAppearanceSettings(true);toast('外觀設定已恢復預設');};
  systemThemeMedia?.addEventListener?.('change',()=>{if(appearanceSettings.theme==='system')applyAppearanceSettings(false);});
  $('#modalBackdrop').addEventListener('click',e=>{if(e.target===$('#modalBackdrop'))closeModal();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#modalBackdrop').hidden)closeModal();toggleAppearancePanel(false);}});

  $('#quickFuelForm').addEventListener('input',e=>{const f=e.currentTarget;if(e.target.name==='liters'||e.target.name==='unitPrice'){const value=(+f.elements.liters.value||0)*(+f.elements.unitPrice.value||0);if(value)f.elements.amount.value=Math.round(value);}});
  $('#quickFuelForm').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget).entries());const item={id:uid(),vehicleId:state.activeVehicleId,date:d.date,odometer:+d.odometer,fuelType:d.fuelType,liters:+d.liters,unitPrice:+d.unitPrice,amount:+d.amount||Math.round(+d.liters*+d.unitPrice),fullTank:d.fullTank==='true'?true:d.fullTank==='false'?false:null,fullTankEstimated:false,odometerEstimated:false,odometerEstimateMethod:'',station:'',usage:'家庭',notes:'',litersEstimated:false,unitPriceEstimated:false,priceSource:'',dataQualityStatus:'confirmed',userConfirmed:true,dataQualityNotes:'使用者新增正式紀錄'};if(!ensureOdometerEntryValid({vehicleId:item.vehicleId,date:item.date,odometer:item.odometer,kind:'fuel',id:item.id}))return;state.fuel.push(item);activeVehicle().odometer=Math.max(activeVehicle().odometer,item.odometer);e.currentTarget.reset();renderAll();toast('快速加油紀錄已儲存');};
  $('#clearQuickFuel').onclick=()=>{$('#quickFuelForm').reset();setQuickDefaults();};
  $$('#trendRange button').forEach(b=>b.onclick=()=>{$$('#trendRange button').forEach(x=>x.classList.remove('active'));b.classList.add('active');trendMonths=+b.dataset.months;renderTrendChart();});
  $('#saveEfficiencySettings').onclick=()=>{
    const tank=nullableNumber($('#fuelTankCapacityInput').value);const reserve=nullableNumber($('#reserveLitersInput').value);const benchmark=nullableNumber($('#benchmarkEfficiencyInput').value);
    if(tank!=null&&reserve!=null&&reserve>=tank)return toast('安全預留油量必須小於油箱容量。','error');
    Object.assign(activeVehicle(),{fuelTankCapacity:tank,reserveLiters:reserve,benchmarkEfficiency:benchmark});
    renderAll();toast('油耗與續航評估設定已儲存');
  };
  $('#efficiencyWindowSelect').onchange=renderEfficiency;
  $('#saveMaintenanceBudgetSettings').onclick=()=>{
    const low=nullableNumber($('#maintenanceBudgetLowInput').value);const high=nullableNumber($('#maintenanceBudgetHighInput').value);const threshold=nullableNumber($('#majorRepairThresholdInput').value);
    if(low==null||high==null||low<0||high<0)return toast('請輸入有效的年度預算範圍。','error');
    if(high<low)return toast('年度合理上限不得低於下限。','error');
    Object.assign(activeVehicle(),{maintenanceBudgetLow:low,maintenanceBudgetHigh:high,majorRepairThreshold:threshold??Math.max(25000,Math.round((high*.5)/1000)*1000)});
    renderAll();toast('車齡與維修效益評估設定已儲存');
  };
  $('#maintenanceEvaluationWindow').onchange=renderMaintenanceEvaluation;
  ['partCategoryFilter','partStatusFilter','partKeywordFilter'].forEach(id=>$('#'+id).addEventListener('input',renderPartAssessment));
  $('#resetPartStandards').onclick=()=>{if(!confirm('確定將零件汰換標準恢復為系統預設值？自行修改的零件週期會被覆蓋，但檢查紀錄會保留。'))return;state.partStandards=structuredClone(DEFAULT_PART_STANDARDS);renderAll();toast('零件汰換標準已恢復預設值');};
  ['#ageSimulationAge','#ageSimulationMileage','#ageSimulationCostFactor'].forEach(sel=>{const el=$(sel);el.oninput=renderAgeDatabaseSimulation;el.onchange=renderAgeDatabaseSimulation;});
  $('#useActualAgeScenario').onclick=()=>{const v=activeVehicle();const age=$('#ageSimulationAge'),mileage=$('#ageSimulationMileage'),factor=$('#ageSimulationCostFactor');age.value=vehicleAgeInfo(v).years??0;mileage.value=Math.round(estimatedAnnualMileage(v.id).value||10000);factor.value=Number(v.maintenanceCostFactor)||1;[age,mileage,factor].forEach(x=>x.dataset.ready='1');renderAgeDatabaseSimulation();toast('已套用目前車輛條件');};
  $('#resetAgeDatabase').onclick=()=>{if(!confirm('確定將車齡維修資料庫恢復為系統預設值？你自行修改的資料庫內容會被覆蓋。'))return;state.maintenanceAgeProfiles=structuredClone(DEFAULT_MAINTENANCE_AGE_PROFILES);renderAll();toast('車齡維修資料庫已恢復預設值');};
  $('#costRecognitionSelect').onchange=e=>{costRecognition=e.target.value||'cash';renderAnalysis();};

  ['maintenanceKeyword','maintenanceTypeFilter','maintenanceStart','maintenanceEnd'].forEach(id=>$('#'+id).addEventListener('input',renderMaintenance));
  ['fuelTypeFilter','fuelStart','fuelEnd','fuelFullFilter'].forEach(id=>$('#'+id).addEventListener('input',renderFuel));
  ['fuelQualityStatusFilter','fuelQualityIssueFilter','fuelQualityKeyword'].forEach(id=>$('#'+id).addEventListener('input',renderFuelQuality));
  $('#fuelAnalysisDataMode').onchange=e=>{state.fuelAnalysisMode=e.target.value==='confirmed'?'confirmed':'all';renderAll();toast(state.fuelAnalysisMode==='confirmed'?'分析已切換為僅使用已確認資料':'分析已切換為含估算／回推資料');};
  $('#createManualSnapshot').onclick=()=>{const snap=createLocalSnapshot('使用者手動建立快照');if(snap){state.lastSnapshotAt=snap.createdAt;save();toast('本機資料快照已建立');}};
  ['obligationTypeFilter','obligationStatusFilter','obligationYearFilter','obligationKeyword'].forEach(id=>$('#'+id).addEventListener('input',renderObligations));

  $('#saveVehicle').onclick=saveActiveVehicle;
  $('#saveVehicleBottom').onclick=saveActiveVehicle;

  $('#printCurrentVehiclePdf').onclick=()=>{const v=activeVehicle();openPrintReport(`${v.name}_車輛完整報告_${today()}`,vehicleReportHtml(v.id));};
  const printServiceShop=()=>{const v=activeVehicle();const range=serviceShopControlRange();const includeCosts=!!$('#serviceShopIncludeCosts').checked;const rangeName=(range.start||range.end)?`_${range.start||'最早'}_${range.end||'最新'}`:'';openPrintReport(`${v.name}_維修廠查看清單${rangeName}_${today()}`,serviceShopReportHtml(v.id,range.value,includeCosts,range.start,range.end),{orientation:'landscape'});};
  $('#printServiceShopReport').onclick=printServiceShop;
  $('#printServiceShopReportTop').onclick=printServiceShop;
  $('#printServiceShopPdf').onclick=printServiceShop;
  $('#serviceShopYears').onchange=()=>{if($('#serviceShopYears').value!=='custom'){serviceShopControlRange();}renderServiceShopList();};
  $('#serviceShopStartDate').onchange=()=>{$('#serviceShopYears').value='custom';normalizeServiceShopCustomDates('start');renderServiceShopList();};
  $('#serviceShopEndDate').onchange=()=>{$('#serviceShopYears').value='custom';normalizeServiceShopCustomDates('end');renderServiceShopList();};
  $('#serviceShopResetDates').onclick=()=>{$('#serviceShopYears').value='5';serviceShopControlRange();renderServiceShopList();toast('已恢復顯示最近5年維修紀錄');};
  $('#serviceShopIncludeCosts').onchange=renderServiceShopList;
  $('#printFleetOverviewPdf').onclick=()=>openPrintReport(`全部車輛總覽報告_${today()}`,fleetReportHtml());
  $('#printFullBackupPdf').onclick=()=>openPrintReport(`車輛管理完整資料列印存檔報告_${today()}`,fullBackupReportHtml());
  $('#exportFuelQualityCsv').onclick=exportFuelQualityCsvFile;
  $('#exportFuelQualityCsvTop').onclick=exportFuelQualityCsvFile;
  $('#exportCalendarIcs').onclick=exportCalendarIcsFile;
  $('#downloadLatestSnapshot').onclick=downloadLatestSnapshotFile;
  $('#restoreLatestSnapshot').onclick=restoreLatestSnapshotData;
  $('#exportFuelCsv').onclick=()=>{const rows=[['日期','年份來源','里程','里程來源','區間行駛公里','區間來源','油品','公升數','公升來源','有效單價','單價來源','牌價估算金額','折價估算','實付金額','是否加滿','加滿來源','油耗km/L','每公里油費','備註'],...computeFuelRows().map(x=>[x.date,x.dateYearInferred?'依紀錄順序回推':'原始日期',x.odometer??'',x.odometerEstimated?(x.odometerEstimateMethod||'估算'):'實際輸入',x.distanceProvided??x.distance??'',x.distanceProvided?'使用者提供里程差':(x.distance?'合併週期計算':''),x.fuelType,x.liters??'',x.litersEstimated?'估算':'實際輸入',x.unitPrice??'',x.unitPriceEstimated?(x.priceSource||'換算'):'實際輸入',hasPositiveNumber(x.liters)&&hasPositiveNumber(x.unitPrice)?(Number(x.liters)*Number(x.unitPrice)).toFixed(2):'',fuelDiscountAmount(x)?fuelDiscountAmount(x).toFixed(2):'',x.amount,fullTankText(x.fullTank,x.fullTankEstimated),x.fullTankEstimated?'依使用者區間紀錄推定':'使用者確認／未確認',x.efficiency?x.efficiency.toFixed(2):'',x.costPerKm?x.costPerKm.toFixed(2):'',x.notes||''])];download(`加油紀錄_${today()}.csv`,csv(rows),'text/csv;charset=utf-8');};
  $('#exportEfficiencyCsv').onclick=()=>{const pf=fuelPerformanceForVehicle(state.activeVehicleId,$('#efficiencyWindowSelect').value||'5');const v=activeVehicle();const rows=[['評估項目','內容'],['車輛',v.name],['車牌',v.plate||''],['油箱容量(L)',pf.tank??''],['安全預留油量(L)',pf.reserve??''],['可用油量(L)',pf.usable??''],['車型參考油耗(km/L)',pf.benchmark??''],['近期加權油耗(km/L)',pf.avg?pf.avg.toFixed(2):''],['參考值達成率(%)',pf.ratio?(pf.ratio*100).toFixed(1):''],['整體評價',pf.grade.label],['理論滿油續航(km)',pf.fullRange?Math.round(pf.fullRange):''],['安全可用續航(km)',pf.safeRange?Math.round(pf.safeRange):''],['保守建議續航(km)',pf.conservativeRange?Math.round(pf.conservativeRange):''],['每100公里油費',pf.costPer100Km!=null?pf.costPer100Km.toFixed(0):''],['資料品質',pf.quality],[],['有效週期日期','距離(km)','加油量(L)','油耗(km/L)','每100公里油費','資料性質'],...pf.valid.slice().reverse().map(x=>[x.date,x.distance,x.cycleLiters?.toFixed(2),x.efficiency?.toFixed(2),x.costPerKm?(x.costPerKm*100).toFixed(0):'',x.efficiencyEstimated?'含估算':'實際輸入'])];download(`油耗續航評估_${v.name}_${today()}.csv`,csv(rows),'text/csv;charset=utf-8');};
  $('#exportMaintenanceCsv').onclick=()=>{const rows=[['日期','印表日期','里程','類型','維修廠','工單編號','項目摘要','逐項明細','零件','工資','折扣','總金額','下次里程','下次日期','備註'],...vm().map(x=>[x.date,x.invoiceDate||'',x.odometer??'',x.type,x.vendor,x.workOrder||'',x.items,(x.details||[]).map(d=>`${d.category||''}｜${d.name||''}｜${d.qty??1}×${d.unitPrice||0}＝${d.amount||0}${d.note?`（${d.note}）`:''}`).join('；'),x.parts,x.labor,x.discount,x.total,x.nextKm||'',x.nextDate||'',x.notes||''])];download(`維修保養紀錄_${today()}.csv`,csv(rows),'text/csv;charset=utf-8');};
  $('#exportAgeDatabaseCsv').onclick=()=>{const rows=[['起始車齡','結束車齡','階段名稱','預算下限','預算上限','準備金','檢查月數','事件下限','事件上限','階段說明','重點項目','例行保養','橡膠油封','冷卻系統','電系','底盤懸吊','引擎傳動','空調便利'],...(state.maintenanceAgeProfiles||[]).map(p=>[p.minAge,p.maxAge??'',p.label,p.budgetLow,p.budgetHigh,p.reserveFund,p.checkMonths,p.eventMin,p.eventMax,p.description,(p.focus||[]).join('、'),p.risk?.routine||1,p.risk?.rubber||1,p.risk?.cooling||1,p.risk?.electrical||1,p.risk?.suspension||1,p.risk?.transmission||1,p.risk?.ac||1])];download(`車齡維修資料庫_${today()}.csv`,csv(rows),'text/csv;charset=utf-8');};
  $('#exportPartAssessmentCsv').onclick=()=>{const v=activeVehicle();const rows=partEvaluationForVehicle(v.id);const csvRows=[['車輛','零件／耗材','分類','適用範圍','評估方式','標準週期','最近更換日期','最近更換里程','已使用公里','已使用月數','最近檢查日期','檢查狀況','系統判斷','判斷依據','建議行動','標準說明'],...rows.map(x=>[v.name,x.std.name,x.std.category,x.std.applicability,x.std.mode,partStandardCycleText(x.std,x.effective),x.lastDate||'',x.lastKm??'',x.kmSince??'',x.elapsedMonths!=null?x.elapsedMonths.toFixed(1):'',x.lastInspectDate||'',conditionLabel(x.condition),x.meta.label,x.reason,x.action,x.std.notes])];download(`零件汰換標準評估_${v.name}_${today()}.csv`,csv(csvRows),'text/csv;charset=utf-8');};
  $('#exportMaintenanceEvaluationCsv').onclick=()=>{const windowValue=$('#maintenanceEvaluationWindow').value||'5';const ev=maintenanceEvaluationForVehicle(state.activeVehicleId,windowValue);const v=activeVehicle();const rows=[['評估項目','內容'],['車輛',v.name],['車牌',v.plate||''],['車齡',ev.age.label],['車齡階段',ev.age.stage],['年均里程',ev.mileage.value!=null?Math.round(ev.mileage.value):''],['評估期間',ev.windowInfo.label],['年度合理下限',ev.budget.low],['年度合理上限',ev.budget.high],['一次性大修門檻',ev.budget.threshold],['期間維修總額',ev.total],['日曆年均實際支出',Math.round(ev.actualAvg)],['有支出年度平均',Math.round(ev.activeYearAvg)],['排除一次性大修後年均',Math.round(ev.normalizedAvg)],['必要支出占比(%)',(ev.essentialRatio*100).toFixed(1)],['維修效益分數',ev.finalScore??''],['綜合評價',ev.grade.label],[],['年度','車齡','工單數','預防保養','故障修復','一次性大修','年度總額'],...ev.years.map(y=>[y.year,y.age??'',y.items.length,Math.round(y.preventive),Math.round(y.repair),Math.round(y.major),Math.round(y.total)]),[],['日期','工單內容','金額','主要效益','必要性','一次性大修','效益說明'],...ev.assessments.map(x=>[x.order.date,x.order.items,Math.round(x.total),MAINTENANCE_BENEFIT_META[x.dominant].label,x.necessity,x.oneOff?'是':'否',x.explanation])];download(`車齡維修效益_${v.name}_${today()}.csv`,csv(rows),'text/csv;charset=utf-8');};
  $('#exportCurrentVehicleCsv').onclick=()=>{const m=metrics(); const v=activeVehicle(); const rows=[['欄位','內容'],['車輛名稱',v.name],['車牌',v.plate||''],['年份',v.year||''],['製造年月',v.manufactureDate||''],['排氣量(CC)',v.engineCc||''],['保養方式',v.maintenanceMode||''],['燃料種類',v.fuelType||''],['車輛用途',v.usage||''],['油箱容量(L)',v.fuelTankCapacity||''],['安全預留油量(L)',v.reserveLiters??''],['車型參考油耗(km/L)',v.benchmarkEfficiency||''],['目前里程',v.odometer],['最近實際油耗(km/L)',m.latestEff?m.latestEff.toFixed(2):''],['本月加油金額',m.fuelMonth],['本年度維修保養費',m.maintYear],['本年度燃油支出',m.fuelYear],['本年度稅金保險驗車費',obligationYearTotal()],['年度行駛里程',m.yearDistance??'資料不足'],['每公里燃油成本',m.fuelCostKm?m.fuelCostKm.toFixed(2):''],['最近提醒',nextReminderTextForVehicle(v.id)]]; download(`目前車輛摘要_${v.name}_${today()}.csv`,csv(rows),'text/csv;charset=utf-8');};
  $('#exportObligationCsv').onclick=()=>{const v=activeVehicle();const rows=[['類型','承辦單位／保險公司','期間起日','期間迄日','到期／應繳日','金額','繳納日','狀態','保單／單號','備註'],...vo().map(x=>[x.type,x.provider,x.periodStart,x.periodEnd,x.dueDate,x.amount,x.paidDate,x.estimatedPaid?'推定已繳':x.status,x.referenceNo,x.notes])];download(`稅金保險驗車_${v.name}_${today()}.csv`,csv(rows),'text/csv;charset=utf-8');};
  $('#exportJson').onclick=()=>{state.lastBackupAt=new Date().toISOString();save();renderAutomation();download(`車輛管理完整備份_${today()}.json`,JSON.stringify(state,null,2),'application/json');};
  $('#importJson').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const obj=JSON.parse(await file.text());if(!obj.vehicles)throw new Error('格式錯誤');createLocalSnapshot('匯入JSON前保護快照');state=migrateData(obj);renderAll();toast(`備份資料已匯入並升級至 V${SCHEMA_VERSION}`);}catch(err){toast('無法匯入：檔案格式不正確','error');}e.target.value='';};
  $('#resetDemo').onclick=()=>{if(confirm('將清除所有加油、維修、提醒、稅費與里程紀錄，但保留目前兩台車的車輛主檔資料，確定繼續？')){createLocalSnapshot('清空所有紀錄前保護快照');state=migrateData({schemaVersion:SCHEMA_VERSION,migrations:{volvoFuelHistoryV52:true,volvoMaintenanceV51:true,volvoUserMaintenanceV52:true,v53QualityCorrections:true,v56ConfirmedFuelCycles:true,v57CloudRevisionGuard:true,v58FinalValidation:true,v563Volvo60kMaintenance:true},activeVehicleId:state.activeVehicleId,vehicles:structuredClone(state.vehicles),fuel:[],maintenance:[],reminders:[],mileageLogs:[],obligations:[],partInspections:[],unclassifiedRecords:[],partStandards:structuredClone(state.partStandards),maintenanceAgeProfiles:structuredClone(state.maintenanceAgeProfiles),automationSettings:structuredClone(state.automationSettings),automationLog:structuredClone(state.automationLog||[]),notificationHistory:structuredClone(state.notificationHistory||{}),lastBackupAt:state.lastBackupAt||'',fuelAnalysisMode:state.fuelAnalysisMode||'all'});renderAll();toast('已清空所有紀錄，車輛主檔已保留；內建資料不會再次自動補回');}};
  $('#globalSearch').addEventListener('input',e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>renderSearchResults(e.target.value),300);});
  $('#globalSearch').addEventListener('focus',e=>{if(e.target.value.trim())renderSearchResults(e.target.value);});

  ['autoEnabled','autoPartReminders','autoObligationReminders','autoUpdateCheck','autoCheckInterval','autoLeadDays','autoLeadKm'].forEach(id=>$('#'+id).addEventListener('change',saveAutomationSettingsFromUi));
  $('#autoBrowserNotifications').addEventListener('change',async e=>{if(e.target.checked)await requestNotificationPermission();else{state.automationSettings.browserNotifications=false;save();renderAutomation();}});
  $('#runAutomationNow').onclick=()=>runAutomaticAssessment({force:true,notify:true,reason:'manual'});
  $('#requestNotificationPermission').onclick=requestNotificationPermission;
  $('#checkAppUpdateNow').onclick=()=>checkForAppUpdate(true);
  $('#installPwaButton').onclick=installPwa;
  $('#clearAutomationLog').onclick=()=>{if(confirm('確定清除自動運行紀錄？')){state.automationLog=[];save();renderAutomation();}};
  $('#downloadAutomationCsv').onclick=()=>{const rows=collectAutomaticAlerts();const data=[['優先度','車輛','車牌','提醒事項','目標日期','目標里程','剩餘狀態','來源','說明'],...rows.map(x=>[automationLevelMeta(x.level).label,x.vehicleName,x.plate,x.reminder.title,x.reminder.targetDate||'',x.reminder.targetKm||'',x.dueText,x.source,x.reminder.notes||''])];download(`自動提醒待辦_${today()}.csv`,csv(data),'text/csv;charset=utf-8');};
  $('#applyAppUpdate').onclick=()=>{if(pwaRegistration?.waiting)pwaRegistration.waiting.postMessage({type:'SKIP_WAITING'});else location.reload();};
  $('#dismissAppUpdate').onclick=()=>{$('#appUpdateBanner').hidden=true;};
  window.addEventListener('online',()=>{pwaRuntime.network='線上';renderAutomation();runAutomaticAssessment({reason:'focus',notify:true,silent:true});});
  window.addEventListener('offline',()=>{pwaRuntime.network='離線';renderAutomation();});
  window.addEventListener('focus',()=>{const last=state.automationSettings?.lastRunAt?Date.now()-new Date(state.automationSettings.lastRunAt).getTime():Infinity;if(last>30*60*1000)runAutomaticAssessment({reason:'focus',notify:true,silent:true});});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){const last=state.automationSettings?.lastRunAt?Date.now()-new Date(state.automationSettings.lastRunAt).getTime():Infinity;if(last>30*60*1000)runAutomaticAssessment({reason:'focus',notify:true,silent:true});}});

  applyAppearanceSettings(false);
  renderAll();
  initPwa();
  scheduleAutomation();
  setTimeout(()=>runAutomaticAssessment({reason:'startup',notify:true,silent:true}),700);
  if(location.hash==='#automation')setTimeout(()=>switchView('automation'),900);
})();
