// 時刻表データ生成スクリプト
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 横浜線全駅リスト（八王子→東神奈川方面）
const allStations = [
  '八王子', '片倉', '八王子みなみ野', '相原', '橋本', '相模原', '矢部',
  '淵野辺', '古淵', '町田', '成瀬', '長津田', '十日市場', '中山',
  '鴨居', '小机', '新横浜', '菊名', '大口', '東神奈川'
];

// 快速停車駅
const rapidStopStations = [
  '八王子', '橋本', '町田', '長津田', '新横浜', '菊名', '東神奈川'
];

// 始発駅リスト（発車本数の重み付き）
const originStations = [
  { station: '八王子', weight: 10 },
  { station: '橋本', weight: 3 },
  { station: '町田', weight: 2 },
  { station: '長津田', weight: 1 }
];

// 各駅間の所要時間（分）
const stationIntervals = {
  '各停': {
    '八王子-片倉': 3,
    '片倉-八王子みなみ野': 3,
    '八王子みなみ野-相原': 3,
    '相原-橋本': 11,
    '橋本-相模原': 3,
    '相模原-矢部': 3,
    '矢部-淵野辺': 3,
    '淵野辺-古淵': 3,
    '古淵-町田': 2,
    '町田-成瀬': 3,
    '成瀬-長津田': 3,
    '長津田-十日市場': 3,
    '十日市場-中山': 3,
    '中山-鴨居': 3,
    '鴨居-小机': 3,
    '小机-新横浜': 12,
    '新横浜-菊名': 18,
    '菊名-大口': 3,
    '大口-東神奈川': 4
  },
  '快速': {
    '八王子-橋本': 15,
    '橋本-町田': 7,
    '町田-長津田': 3,
    '長津田-新横浜': 3,
    '新横浜-菊名': 18,
    '菊名-東神奈川': 7
  }
};

// 東神奈川から横浜までの所要時間
const toYokohamaTime = 5;

// 重み付けランダム選択
const weightedRandom = (items) => {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item.station;
  }

  return items[0].station;
};

const generateTimetableData = () => {
  const trains = [];
  let trainNumber = 1;

  // 5:00から23:30まで列車を生成
  for (let hour = 5; hour < 24; hour++) {
    const isRushHour = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
    const interval = isRushHour ? 7 : 12;

    for (let minute = 0; minute < 60; minute += interval) {
      // 始発駅を決定
      const originStation = weightedRandom(originStations);
      const originIndex = allStations.indexOf(originStation);

      // 快速か各停かを決定（始発駅が快速停車駅の場合のみ快速にする可能性）
      const canBeRapid = rapidStopStations.includes(originStation);
      const isRapid = canBeRapid && (trains.length % 3 === 0); // 3本に1本は快速
      const trainType = isRapid ? '快速' : '各停';

      // 横浜直通かを決定
      const directProbability = isRushHour ? 0.2 : 0.1;
      const isDirectToYokohama = Math.random() < directProbability;
      const destination = isDirectToYokohama ? '桜木町' : '東神奈川';

      const train = {
        trainNumber: String(trainNumber).padStart(4, '0'),
        trainType: trainType,
        destination: destination,
        times: {},
        originStation: originStation
      };

      let currentMinutes = hour * 60 + minute;

      if (trainType === '快速') {
        // 快速の場合
        for (let i = 0; i < allStations.length; i++) {
          const station = allStations[i];

          if (i < originIndex) {
            // 始発駅より前
            train.times[station] = '-';
          } else if (rapidStopStations.includes(station)) {
            // 停車駅
            train.times[station] = currentMinutes;

            // 次の停車駅までの所要時間を加算
            if (i < allStations.length - 1) {
              const nextRapidStation = allStations.slice(i + 1).find(s => rapidStopStations.includes(s));
              if (nextRapidStation) {
                const key = `${station}-${nextRapidStation}`;
                currentMinutes += stationIntervals['快速'][key] || 0;
              }
            }
          } else {
            // 通過駅
            train.times[station] = '->';
          }
        }
      } else {
        // 各停の場合
        for (let i = 0; i < allStations.length; i++) {
          const station = allStations[i];

          if (i < originIndex) {
            // 始発駅より前
            train.times[station] = '-';
          } else {
            // 停車駅
            train.times[station] = currentMinutes;

            // 次の駅までの所要時間を加算
            if (i < allStations.length - 1) {
              const nextStation = allStations[i + 1];
              const key = `${station}-${nextStation}`;
              currentMinutes += stationIntervals['各停'][key] || 0;
            }
          }
        }
      }

      // 東神奈川到着が24時を超える場合はスキップ
      const higakanaArrival = train.times['東神奈川'];
      if (typeof higakanaArrival === 'number' && higakanaArrival >= 24 * 60) continue;

      // 番線を決定（快速は1番線、各停は2番線、ただし時間帯によって変動も）
      train.platform = trainType === '快速' ? 1 : 2;

      // 横浜到着時刻を計算
      if (isDirectToYokohama) {
        train.yokohamaArrival = higakanaArrival + toYokohamaTime;
      } else {
        train.yokohamaArrival = '-';
      }

      trains.push(train);
      trainNumber++;
    }
  }

  // 東神奈川到着時刻順にソート
  trains.sort((a, b) => {
    const timeA = typeof a.times['東神奈川'] === 'number' ? a.times['東神奈川'] : 9999;
    const timeB = typeof b.times['東神奈川'] === 'number' ? b.times['東神奈川'] : 9999;
    return timeA - timeB;
  });

  // 列車番号を振り直し
  trains.forEach((train, index) => {
    train.trainNumber = String(index + 1).padStart(4, '0');
  });

  // CSVヘッダーを生成
  const stationColumns = allStations.map(s => s + '発').join(',');
  const header = `列車番号,種別,行先,${stationColumns},番線,横浜着`;

  // CSV行を生成
  const csvLines = [header];

  trains.forEach(train => {
    const stationTimes = allStations.map(station => {
      const time = train.times[station];
      if (time === '-' || time === '->') return time;

      const h = Math.floor(time / 60);
      const m = time % 60;
      return String(h).padStart(2, '0') + String(m).padStart(2, '0');
    }).join(',');

    const yokohamaTime = train.yokohamaArrival === '-' ? '-' : (() => {
      const h = Math.floor(train.yokohamaArrival / 60);
      const m = train.yokohamaArrival % 60;
      return String(h).padStart(2, '0') + String(m).padStart(2, '0');
    })();

    csvLines.push(`${train.trainNumber},${train.trainType},${train.destination},${stationTimes},${train.platform},${yokohamaTime}`);
  });

  return csvLines.join('\n');
};

// CSVファイルを生成
const csvData = generateTimetableData();
const outputPath = path.join(__dirname, '..', 'public', 'data', 'timetable.csv');

// ディレクトリが存在しない場合は作成
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(outputPath, csvData, 'utf-8');
console.log(`時刻表データを生成しました: ${outputPath}`);
console.log(`総列車数: ${csvData.split('\n').length - 1}本（ヘッダー除く）`);
