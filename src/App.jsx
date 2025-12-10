import { useState, useEffect } from 'react';
import { Train, MapPin, Clock } from 'lucide-react';
import Papa from 'papaparse';

// 横浜線全駅リスト（八王子→東神奈川方面）
const allStations = [
  '八王子', '片倉', '八王子みなみ野', '相原', '橋本', '相模原', '矢部',
  '淵野辺', '古淵', '町田', '成瀬', '長津田', '十日市場', '中山',
  '鴨居', '小机', '新横浜', '菊名', '大口', '東神奈川'
];

// 主要駅
const majorStations = ['八王子', '橋本', '町田', '長津田', '新横浜'];

const App = () => {
  const [selectedStation, setSelectedStation] = useState('');
  const [nextTrains, setNextTrains] = useState([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [timetableData, setTimetableData] = useState([]);
  const [loading, setLoading] = useState(true);

  // 現在時刻を取得
  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  // CSVデータを読み込み
  useEffect(() => {
    fetch('/data/timetable.csv')
      .then(response => response.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          complete: (results) => {
            setTimetableData(results.data);
            setLoading(false);
          }
        });
      })
      .catch(error => {
        console.error('CSV読み込みエラー:', error);
        setLoading(false);
      });
  }, []);

  // ページ読み込み時に前回選択した駅を復元
  useEffect(() => {
    const saved = localStorage.getItem('lastSelectedStation');
    if (saved && allStations.includes(saved)) {
      setSelectedStation(saved);
    }
    setSelectedTime(getCurrentTime());
  }, []);

  // 駅選択時の処理
  useEffect(() => {
    if (selectedStation && selectedStation !== '東神奈川' && timetableData.length > 0) {
      localStorage.setItem('lastSelectedStation', selectedStation);

      const referenceTime = useCurrentTime ? getCurrentTime() : selectedTime;
      const [refHour, refMinute] = referenceTime.split(':').map(Number);
      const refMinutes = refHour * 60 + refMinute;

      // 選択した駅のカラム名
      const stationColumn = selectedStation + '発';

      // 該当駅を発車する列車を抽出
      const trainsFromStation = timetableData
        .map(train => {
          const departureTime = train[stationColumn];

          // "-"や"->"の場合はスキップ
          if (!departureTime || departureTime === '-' || departureTime === '->') {
            return null;
          }

          // 時刻を分に変換
          const depHour = parseInt(departureTime.substring(0, 2));
          const depMinute = parseInt(departureTime.substring(2, 4));
          const depMinutes = depHour * 60 + depMinute;

          // 参照時刻より前ならスキップ
          if (depMinutes < refMinutes) {
            return null;
          }

          // 東神奈川到着時刻を取得
          const arrivalTime = train['東神奈川発'];
          const arrHour = parseInt(arrivalTime.substring(0, 2));
          const arrMinute = parseInt(arrivalTime.substring(2, 4));
          const arrMinutes = arrHour * 60 + arrMinute;

          return {
            trainNumber: train['列車番号'],
            trainType: train['種別'],
            destination: train['行先'],
            departure: `${String(depHour).padStart(2, '0')}:${String(depMinute).padStart(2, '0')}`,
            arrival: `${String(arrHour).padStart(2, '0')}:${String(arrMinute).padStart(2, '0')}`,
            arrivalMinutes: arrMinutes,
            platform: parseInt(train['番線']),
            directToYokohama: train['行先'] === '桜木町'
          };
        })
        .filter(train => train !== null)
        .sort((a, b) => a.arrivalMinutes - b.arrivalMinutes)
        .slice(0, 2);

      setNextTrains(trainsFromStation);
    } else {
      setNextTrains([]);
    }
  }, [selectedStation, selectedTime, useCurrentTime, timetableData]);

  // 1秒ごとに現在時刻を更新
  useEffect(() => {
    if (useCurrentTime) {
      const timer = setInterval(() => {
        setSelectedTime(getCurrentTime());
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [useCurrentTime]);

  const handleMajorStationClick = (station) => {
    setSelectedStation(station);
  };

  const handleTimeChange = (e) => {
    setSelectedTime(e.target.value);
    setUseCurrentTime(false);
  };

  const handleUseCurrentTime = () => {
    setSelectedTime(getCurrentTime());
    setUseCurrentTime(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-3 md:p-6 flex items-center justify-center">
        <div className="text-gray-600">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-3 md:p-6 md:flex md:items-center md:justify-center">
      <div className="max-w-md mx-auto w-full">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Train className="w-6 h-6 text-blue-600" />
            <h1 className="text-lg font-bold text-gray-800">
              横浜線 東神奈川到着番線
            </h1>
          </div>
          <p className="text-gray-600 text-xs">
            到着時刻が早い順に表示
          </p>
        </div>

        {/* 主要駅クイック選択ボタン */}
        <div className="bg-white rounded-lg shadow-lg p-3 mb-3">
          <h2 className="font-semibold text-gray-700 text-sm mb-2 flex items-center gap-1">
            <MapPin className="w-4 h-4 text-blue-600" />
            主要駅
          </h2>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {majorStations.map(station => (
              <button
                key={station}
                onClick={() => handleMajorStationClick(station)}
                className={`px-3 py-2 rounded-lg font-semibold text-sm whitespace-nowrap transition-all flex-shrink-0 ${
                  selectedStation === station
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {station}
              </button>
            ))}
          </div>
        </div>

        {/* 全駅選択プルダウン */}
        <div className="bg-white rounded-lg shadow-lg p-3 mb-3">
          <label className="block">
            <div className="flex items-center gap-1 mb-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-gray-700 text-sm">全駅</span>
            </div>
            <select
              value={selectedStation}
              onChange={(e) => setSelectedStation(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
            >
              <option value="">-- 駅を選択 --</option>
              {allStations.filter(s => s !== '東神奈川').map(station => (
                <option key={station} value={station}>{station}</option>
              ))}
            </select>
          </label>
        </div>

        {/* 時刻選択 */}
        <div className="bg-white rounded-lg shadow-lg p-3 mb-3">
          <div className="flex items-center gap-1 mb-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-gray-700 text-sm">基準時刻</span>
          </div>
          <div className="flex gap-2">
            <input
              type="time"
              value={selectedTime}
              onChange={handleTimeChange}
              className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
            />
            <button
              onClick={handleUseCurrentTime}
              className={`px-3 py-2 rounded-lg font-semibold text-xs whitespace-nowrap ${
                useCurrentTime
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              現在
            </button>
          </div>
        </div>

        {/* 列車情報表示（横並び） */}
        {nextTrains.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {nextTrains.map((train, index) => {
              // 番線による色分け（1,2番線は黄緑、3,4番線は濃い緑）
              const platformColor = train.platform <= 2
                ? 'from-lime-500 to-lime-600'
                : 'from-green-600 to-green-700';

              // 列車種別の色（各停は黄緑、快速はピンク）
              const trainTypeColor = train.trainType === '各停'
                ? 'bg-lime-400 text-white'
                : 'bg-pink-400 text-white';

              // 列車カードの枠線色（東神奈川行きは黄緑、横浜直通は水色）
              const borderColor = train.directToYokohama
                ? 'border-cyan-400'
                : 'border-lime-400';

              return (
                <div
                  key={index}
                  className={`bg-white rounded-lg shadow-lg p-3 border-2 ${borderColor}`}
                >
                  <div className="flex flex-wrap items-center gap-1 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${trainTypeColor}`}>
                      {train.trainType}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-xs text-gray-600">発車</div>
                      <div className="text-xl font-bold text-gray-800">
                        {train.departure}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{selectedStation}</div>
                    </div>

                    <div className="bg-gray-50 rounded p-2">
                      <div className="text-xs text-gray-600">到着</div>
                      <div className="text-xl font-bold text-gray-800">
                        {train.arrival}
                      </div>
                      <div className="text-xs text-gray-500">東神奈川</div>
                    </div>

                    <div className={`bg-gradient-to-br ${platformColor} rounded p-2 text-white text-center`}>
                      <div className="text-xs opacity-90">到着番線</div>
                      <div className="text-3xl font-bold">
                        {train.platform}
                      </div>
                      <div className="text-xs opacity-90">番線</div>
                    </div>

                    {train.directToYokohama && (
                      <div className="px-2 py-1 bg-cyan-400 text-white rounded text-xs font-semibold text-center">
                        {train.destination}行
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedStation && nextTrains.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center mb-3">
            <p className="text-gray-600 text-sm">
              指定時刻以降の列車がありません
            </p>
          </div>
        )}

        {!selectedStation && (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center mb-3">
            <Train className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">
              乗車駅を選択してください
            </p>
          </div>
        )}

        {/* フッター */}
        <div className="text-center text-xs text-gray-600 bg-white rounded-lg p-3 shadow">
          <p className="font-semibold mb-1">デバッグ用サンプル</p>
          <p>※ 実際のダイヤとは異なります</p>
        </div>
      </div>
    </div>
  );
};

export default App;
