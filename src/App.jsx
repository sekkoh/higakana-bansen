import { useState, useEffect } from 'react';
import { Train, MapPin } from 'lucide-react';
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
  const [dayType, setDayType] = useState('weekday'); // 'weekday' or 'holiday'
  const [holidaySet, setHolidaySet] = useState(new Set());

  // 現在時刻を取得
  const getCurrentTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  // 曜日から運行日種別を判定（土日は休日扱い）
  const detectDayType = () => {
    const now = new Date();
    
    // 「-2時間した時刻」で曜日を判定
    const shiftedDate = new Date(now.getTime());
    shiftedDate.setHours(now.getHours() - 2);

    // 祝日かどうか判定（YYYY-MM-DD）
    const y = shiftedDate.getFullYear();
    const m = String(shiftedDate.getMonth() + 1).padStart(2, '0');
    const d = String(shiftedDate.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${d}`;

    if (holidaySet.has(key)) {
      return 'holiday';
    }

    // 土日判定
    const day = shiftedDate.getDay(); // 0:日, 6:土
    return (day === 0 || day === 6) ? 'holiday' : 'weekday';
  };

  // 祝日CSV読み込み
  useEffect(() => {
    fetch('/data/syukujitsu.csv')
      .then(res => res.text())
      .then(text => {
        const lines = text.split('\n');
        const set = new Set();

        lines.forEach(line => {
          const raw = line.trim();
          if (!raw) return;

          const [dateStr] = raw.split(','); // 例: "2020/2/23"
          if (!dateStr) return;

          const parts = dateStr.split('/');  // ["2020", "2", "23"]
          if (parts.length !== 3) return;

          const y = parts[0];
          const m = parts[1].padStart(2, '0');
          const d = parts[2].padStart(2, '0');

          const formatted = `${y}-${m}-${d}`;
          set.add(formatted);
        });

        setHolidaySet(set);
      })
      .catch(err => console.error('祝日CSV読み込みエラー:', err));
  }, []);

  // ページ読み込み時に運行日種別を自動判定
  useEffect(() => {
    setDayType(detectDayType());
  }, [holidaySet]);

  // 時刻表CSVデータを読み込み（運行日種別に応じて切り替え）
  useEffect(() => {
    setLoading(true);
    const filename = dayType === 'weekday'
      ? '/data/timetable-weekday.csv'
      : '/data/timetable-holiday.csv';

    fetch(filename)
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
  }, [dayType]);

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
      // 列車時刻と比較するための分データ：１時５９分までは25:59として計算
      const refMinutes = (refHour < 2) ? (refHour + 24) * 60 + refMinute : refHour * 60 + refMinute;

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

          // 横浜到着時刻を取得
          const yokohamaArrival = train['横浜着'];
          let yokohamaArrivalFormatted = null;
          if (yokohamaArrival && yokohamaArrival !== '-') {
            const yokohamaHour = parseInt(yokohamaArrival.substring(0, 2));
            const yokohamaMinute = parseInt(yokohamaArrival.substring(2, 4));
            yokohamaArrivalFormatted = `${String(yokohamaHour).padStart(2, '0')}:${String(yokohamaMinute).padStart(2, '0')}`;
          }

          return {
            trainNumber: train['列車番号'],
            trainType: train['種別'],
            destination: train['行先'],
            departure: `${String(depHour).padStart(2, '0')}:${String(depMinute).padStart(2, '0')}`,
            arrival: `${String(arrHour).padStart(2, '0')}:${String(arrMinute).padStart(2, '0')}`,
            arrivalMinutes: arrMinutes,
            platform: parseInt(train['番線']),
            directToYokohama: train['行先'] !== '東神奈川',
            yokohamaArrival: yokohamaArrivalFormatted
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
    setDayType(detectDayType());
  };

  const handleDayTypeChange = (type) => {
    setDayType(type);
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

        {/* 統合コントロールパネル */}
        <div className="bg-white rounded-lg shadow-lg p-3 mb-3">
          {/* 平日／土休日、時刻入力、現在ボタン */}
          <div className='mb-2'>
            <div className="text-xs font-semibold text-gray-600 mb-1">曜日・時刻選択</div>
              <div className="flex gap-2 mb-3">
              <button
                onClick={() => handleDayTypeChange('weekday')}
                className={`px-3 py-2 rounded-lg font-semibold text-sm ${
                  dayType === 'weekday'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                平日
              </button>
              <button
                onClick={() => handleDayTypeChange('holiday')}
                className={`px-3 py-2 rounded-lg font-semibold text-sm ${
                  dayType === 'holiday'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                土休日
              </button>
              <input
                type="time"
                value={selectedTime}
                onChange={handleTimeChange}
                className="w-32 px-2 py-1.5 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-sm"
              />
              <button
                onClick={handleUseCurrentTime}
                className={`px-3 py-2 rounded-lg font-semibold text-sm whitespace-nowrap ${
                  useCurrentTime
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                現在
              </button>
            </div>
          </div>
          

          {/* 主要駅から選択 */}
          <div className="mb-2">
            <div className="text-xs font-semibold text-gray-600 mb-1">主要駅から選択</div>
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

          {/* 全駅 */}
          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1">全駅</div>
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
          </div>
        </div>

        {/* 列車情報表示 */}
        {nextTrains.length > 0 && (
          <div className="flex gap-2 mb-3">
            {/* 左側: 駅情報 */}
            <div className="flex flex-col py-3 px-2 bg-white rounded-lg shadow-lg">
              <div className="text-center flex items-center justify-center h-5">
                <div className="text-xs text-gray-600">種別</div>
              </div>

              <div className="border-t border-gray-300 my-2"></div>

              <div className="text-center flex flex-col justify-center h-15">
                <div className="text-base font-bold text-gray-800 whitespace-nowrap">
                  {selectedStation}
                </div>
                <div className="text-xs text-gray-600 mt-1">発</div>
              </div>

              <div className="border-t border-gray-300 my-2"></div>

              <div className="text-center flex flex-col justify-center h-15">
                <div className="text-base font-bold text-gray-800 whitespace-nowrap">
                  東神奈川
                </div>
                <div className="text-xs text-gray-600 mt-1">着</div>
              </div>

              <div className="border-t border-gray-300 my-2"></div>

              <div className="text-center flex items-center justify-center h-12">
                <div className="text-xs text-gray-600">番線</div>
              </div>

              <div className="border-t border-gray-300 my-2"></div>

              <div className="text-center flex flex-col justify-center h-15">
                <div className="text-base font-bold text-gray-800 whitespace-nowrap">
                  横浜
                </div>
                <div className="text-xs text-gray-600 mt-1">着</div>
              </div>
            </div>

            {/* 右側: 列車カード2列 */}
            <div className="flex-1 grid grid-cols-2 gap-2">
              {nextTrains.map((train, index) => {
                // 番線による色分け（1,2番線は水色、それ以外は背景色なし）
                const platformColor = train.platform <= 2
                  ? 'bg-gradient-to-br from-cyan-500 to-cyan-600'
                  : 'bg-gray-50';
                const platformTextColor = train.platform <= 2
                  ? 'text-white'
                  : 'text-gray-800';

                // 列車種別の色（各停は濃い黄緑、快速は赤）
                const trainTypeColor = train.trainType === '普通'
                  ? 'bg-lime-600 text-white'
                  : 'bg-red-500 text-white';

                // 列車カードの枠線色（東神奈川行きは黄緑、横浜直通は水色）
                const borderColor = train.directToYokohama
                  ? 'border-cyan-500'
                  : 'border-lime-500';

                // 横浜到着時刻の背景色（横浜直通は水色、それ以外は灰色）
                const yokohamaBgColor = train.directToYokohama && train.yokohamaArrival
                  ? 'bg-gradient-to-br from-cyan-500 to-cyan-600'
                  : 'bg-gray-50';
                const yokohamaTextColor = train.directToYokohama && train.yokohamaArrival
                  ? 'text-white'
                  : 'text-gray-400';

                return (
                  <div
                    key={index}
                    className={`bg-white rounded-lg shadow-lg p-3 border-8 ${borderColor} flex flex-col`}
                  >
                    <div className={`${trainTypeColor} rounded p-1 text-white flex items-center justify-center h-5`}>
                      <span className="text-xs font-semibold">
                        {train.trainType}
                      </span>
                    </div>

                    <div className="border-t border-gray-300 my-2"></div>

                    <div className="flex items-center justify-center bg-gray-50 rounded p-2 h-15">
                      <div className="text-2xl font-bold text-gray-800">
                        {train.departure}
                      </div>
                    </div>

                    <div className="border-t border-gray-300 my-2"></div>

                    <div className="flex items-center justify-center bg-gray-50 rounded p-2 h-15">
                      <div className="text-2xl font-bold text-gray-800">
                        {train.arrival}
                      </div>
                    </div>

                    <div className="border-t border-gray-300 my-2"></div>

                    <div className={`${platformColor} rounded p-2 ${platformTextColor} flex items-center justify-center h-12`}>
                      <div className="flex items-center gap-1">
                        <div className="text-3xl font-bold">
                          {train.platform}
                        </div>
                        <div className="text-lg font-bold">
                          番線
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-300 my-2"></div>

                    <div className={`flex items-center justify-center ${yokohamaBgColor} rounded p-2 h-15`}>
                      {train.directToYokohama && train.yokohamaArrival ? (
                        <div className={`text-2xl font-bold ${yokohamaTextColor}`}>
                          {train.yokohamaArrival}
                        </div>
                      ) : (
                        <div className={yokohamaTextColor}>-</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
          <p className="font-semibold mb-1">ベータ版です（2025/3/15の時刻表データ）</p>
          <p>※ 本アプリを利用して発生した損害について当方は一切関与しません</p>
        </div>
      </div>
    </div>
  );
};

export default App;
