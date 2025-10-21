import React, { useState, useEffect, useRef, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, Html } from "@react-three/drei";
import * as THREE from "three";
import { db, envOk } from "./firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

/* ===============================
   ДВУХПОЛЬЗОВАТЕЛЬСКИЙ 3D-КВИЗ
   (оригинальные материалы, белый фон,
   автоцентр и автоскейл моделей)
   =============================== */

// --- Твой датасет (пути к моделям из public/organs/...) ---
const QUESTIONS = [
  {
    id: "stomach",
    title: "Желудок",
    prompt: "Какой кислотой желудок переваривает пищу?",
    modelUrl: "/organs/realistic_human_stomach.glb",
    options: ["Серная кислота", "Фосфорная кислота", "Соляная кислота (HCl)", "Азотная кислота"],
    correctIndex: 2,
    fit: 1.7,
  },
  {
    id: "heart",
    title: "Сердце",
    prompt: "Какая часть сердца перекачивает кровь по всему телу?",
    modelUrl: "/organs/realistic_human_heart.glb",
    options: ["Правое предсердие", "Левый желудочек", "Левое предсердие", "Правый желудочек"],
    correctIndex: 1,
    // rotation: [0, 0, 0], fit: 2.8, highlightPart: "LeftVentricle"
  },

  {
    id: "lungs",
    title: "Лёгкие",
    prompt: "Что происходит в альвеолах лёгких?",
    modelUrl: "/organs/realistic_human_lungs.glb",
    options: ["Газообмен между воздухом и кровью", "Производство гормонов", "Фильтрация крови", "Переваривание пищи"],
    correctIndex: 0,
  },

  {
    id: "brain",
    title: "Мозг",
    prompt: "Какая часть мозга отвечает за координацию движений?",
    modelUrl: "/organs/human_brain.glb",
    options: ["Большие полушария", "Мозжечок", "Продолговатый мозг", "Гипоталамус"],
    correctIndex: 1,
  },

  {
    id: "kidney",
    title: "Почка",
    prompt: "Основная функция почек — это...",
    modelUrl: "/organs/medicine_organ_-_the_human_kidney.glb",
    options: ["Секреция гормонов", "Синтез белков", "Фильтрация крови и выделение мочи", "Выработка жёлчи"],
    correctIndex: 2,
  },

  

  {
    id: "liver",
    title: "Печень",
    prompt: "Какой орган вырабатывает жёлчь?",
    modelUrl: "/organs/human_liver_and_gallbladder.glb",
    options: ["Жёлчный пузырь", "Печень", "Поджелудочная железа", "Почка"],
    correctIndex: 1,
  },

  {
    id: "small_intestine",
    title: "Тонкий кишечник",
    prompt: "Что происходит в тонком кишечнике в основном?",
    modelUrl: "/organs/small_and_large_intestine.glb",
    options: ["Поглощение питательных веществ", "Поглощение воды", "Газообмен", "Фильтрация крови"],
    correctIndex: 0,
  },

  {
    id: "large_intestine",
    title: "Толстый кишечник",
    prompt: "Основная функция толстого кишечника — это...",
    modelUrl: "/organs/small_and_large_intestine.glb",
    options: ["Поглощение питательных веществ", "Поглощение воды", "Выделение гормонов", "Производство ферментов"],
    correctIndex: 1,
  },

  {
    id: "skin",
    title: "Кожа",
    prompt: "В каком слое кожи располагаются потовые железы?",
    modelUrl: "/organs/spotted_skin.glb",
    options: ["Эпидермис", "Дерма", "Подкожная клетчатка", "Роговой слой"],
    correctIndex: 1,
  },

  {
    id: "eye",
    title: "Глаз",
    prompt: "Какая часть глаза фокусирует свет на сетчатке?",
    modelUrl: "/organs/anatomi_mata_eye_anatomy.glb",
    options: ["Зрачок", "Хрусталик", "Роговица", "Сетчатка"],
    correctIndex: 1,
  },
];

// ---------- UI helpers ----------
function Input({ label, value, onChange, placeholder }) {
  return (
    <label className="block text-sm text-gray-300 mb-3">
      <span>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full px-3 py-2 rounded-xl bg-gray-800 text-gray-100 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-400"
      />
    </label>
  );
}

function Button({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-4 py-2 transition disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Fallback({ msg }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-100 p-6">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 max-w-md">
        <h1 className="text-2xl font-bold mb-3">App error</h1>
        <p className="text-gray-300">{msg}</p>
        <p className="text-gray-400 text-sm mt-3">Проверь .env и перезапусти npm run dev.</p>
      </div>
    </div>
  );
}

/* ---------- 3D: нормализация модели (центр + масштаб) без перекраски ---------- */
function NormalizedModel({ url, fit = 2.8, rotation = [0, 0, 0] }) {
  const { scene } = useGLTF(url);
  const group = useRef();

  useEffect(() => {
    // габариты и центр
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // центрируем модель в (0,0,0)
    scene.position.sub(center);

    // масштаб: большая грань = fit
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = fit / maxDim;
    if (group.current) {
      group.current.scale.setScalar(scale);
      group.current.rotation.set(rotation[0], rotation[1], rotation[2]);
    }

    // тени
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    // отладка в dev
    if (import.meta.env.DEV) {
      console.groupCollapsed("GLB hierarchy:", url);
      const pad = (n) => "  ".repeat(n);
      const print = (node, depth = 0) => {
        console.log(`${pad(depth)}• ${node.type}${node.name ? ` (${node.name})` : ""}`);
        node.children?.forEach((c) => print(c, depth + 1));
      };
      print(scene);
      console.groupEnd();
    }
  }, [scene, fit, rotation, url]);

  return (
    <group ref={group}>
      <primitive object={scene} dispose={null} />
    </group>
  );
}

/* ---------- MAIN APP ---------- */
export default function App() {
  if (!envOk) return <Fallback msg="Firebase ENV не подхватились (projectId = undefined)." />;
  if (!db) return <Fallback msg="Firebase не инициализировался. Смотри консоль браузера." />;

  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(false);

  // Подписка на комнату
  useEffect(() => {
    if (!roomCode) return;
    const ref = doc(db, "rooms", roomCode);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setRoom(snap.data());
    });
    return () => unsub();
  }, [roomCode]);

  function logAndAlert(e) {
    console.error(e);
    alert(e?.message || "Firestore error. Check console and rules.");
  }

  // Создать / присоединиться к комнате
  async function joinRoom() {
    if (!roomCode || !playerName) return;
    setLoading(true);
    try {
      const ref = doc(db, "rooms", roomCode);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        await setDoc(ref, {
          createdAt: serverTimestamp(),
          players: { [playerName]: { score: 0, joinedAt: serverTimestamp() } },
          stage: "lobby",
          currentIndex: 0,
          answers: {},
        });
      } else {
        const data = snap.data();
        await updateDoc(ref, {
          players: {
            ...(data.players || {}),
            [playerName]: { score: 0, joinedAt: serverTimestamp() },
          },
        });
      }
    } catch (e) {
      logAndAlert(e);
    } finally {
      setLoading(false);
    }
  }

  // Старт квиза (Solo для теста)
  async function startQuiz(forceSolo = false) {
    try {
      const ref = doc(db, "rooms", roomCode);
      const playersCount = room ? Object.keys(room.players || {}).length : 0;
      if (forceSolo || playersCount >= 2) {
        await updateDoc(ref, { stage: "quiz", currentIndex: 0, answers: {} });
      } else {
        alert("Нужно минимум 2 игрока (или нажми Solo Start для теста).");
      }
    } catch (e) {
      logAndAlert(e);
    }
  }

  // Ответ
  async function submitAnswer(index) {
    if (!room) return;
    const q = QUESTIONS[room.currentIndex];
    const ref = doc(db, "rooms", roomCode);

    const already = room.answers?.[playerName]?.[q.id] !== undefined;

    const curr = room.answers || {};
    const my = { ...(curr[playerName] || {}), [q.id]: index };
    try {
      await updateDoc(ref, { answers: { ...curr, [playerName]: my } });

      if (!already && index === q.correctIndex) {
        const players = room.players || {};
        const me = players[playerName] || { score: 0 };
        await updateDoc(ref, {
          players: { ...players, [playerName]: { ...me, score: (me.score || 0) + 1 } },
        });
      }
    } catch (e) {
      logAndAlert(e);
    }
  }

  // Дальше (когда все ответили)
  async function nextQuestion() {
    if (!room) return;
    const ref = doc(db, "rooms", roomCode);
    const next = room.currentIndex + 1;
    try {
      if (next < QUESTIONS.length) {
        await updateDoc(ref, { currentIndex: next });
      } else {
        await updateDoc(ref, { stage: "results" });
      }
    } catch (e) {
      logAndAlert(e);
    }
  }

  /* ---------- LOBBY ---------- */
  if (!room || room.stage === "lobby") {
    const playersList = room ? Object.keys(room.players || {}) : [];
    const canStart = playersList.length >= 2;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-gray-100 px-6">
        <h1 className="text-3xl font-bold mb-4">3D Quiz Duel</h1>
        <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800 w-full max-w-sm">
          <Input label="Room Code" value={roomCode} onChange={setRoomCode} placeholder="e.g. BIO123" />
          <Input label="Your Name" value={playerName} onChange={setPlayerName} placeholder="e.g. Ali" />
          <div className="flex gap-3 mt-2 flex-wrap">
            <Button onClick={joinRoom} disabled={loading}>{loading ? "Joining..." : "Create / Join"}</Button>
            <Button onClick={() => startQuiz(false)} disabled={!canStart}>Start</Button>
            
          </div>
          <div className="text-gray-400 text-sm mt-3">
            Players in room: {playersList.length ? playersList.join(", ") : "—"}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- QUIZ ---------- */
  if (room.stage === "quiz") {
    const q = QUESTIONS[room.currentIndex];
    const players = room.players || {};
    const totalPlayers = Object.keys(players).length;

    const answers = room.answers || {};
    const answeredCount = Object.values(answers).reduce((acc, perPlayer) => {
      return acc + (perPlayer && perPlayer[q.id] !== undefined ? 1 : 0);
    }, 0);
    const allAnswered = answeredCount >= totalPlayers;

    const myPick = answers?.[playerName]?.[q.id];
    const reveal = allAnswered;

    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 p-6 space-y-6">
        <header className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">3D Quiz Duel</h1>
          <div className="text-sm text-gray-400">Room: {roomCode}</div>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 3D */}
          <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden">
            <div className="h-96">
              <Canvas
                camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 100 }}
                gl={{ antialias: false, powerPreference: "high-performance" }}
                dpr={[1, 2]}
              >
                {/* Белый фон */}
                <color attach="background" args={["#ffffff"]} />

                {/* Свет */}
                <ambientLight intensity={0.35} />
                <directionalLight position={[5, 5, 5]} intensity={1.0} />

                <Suspense fallback={<Html center>Loading 3D...</Html>}>
                  <NormalizedModel
                    url={q.modelUrl}
                    fit={q.fit ?? 2.8}
                    rotation={q.rotation ?? [0, 0, 0]}
                  />
                </Suspense>

                {/* Управление */}
                <OrbitControls
                  makeDefault
                  target={[0, 0, 0]}
                  enablePan={false}
                  enableDamping
                  dampingFactor={0.08}
                  minDistance={1.5}
                  maxDistance={8}
                />
              </Canvas>
            </div>
            <div className="p-4 text-gray-700">
              <p className="font-semibold text-lg">{q.title}</p>
              <p className="text-sm text-gray-500">Поверни модель, чтобы рассмотреть детали.</p>
            </div>
          </div>

          {/* Вопрос */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 space-y-4">
            <h2 className="text-xl font-bold">Вопрос {room.currentIndex + 1} / {QUESTIONS.length}</h2>
            <p>{q.prompt}</p>
            <div className="space-y-3">
              {q.options.map((opt, i) => {
                const picked = myPick === i;
                const correct = i === q.correctIndex;

                let stateClass = "border-gray-700 hover:border-cyan-400";
                if (picked) stateClass = "border-cyan-400 bg-cyan-500/10";
                if (reveal) {
                  if (correct) stateClass = "border-green-500 bg-green-500/10";
                  else if (picked && !correct) stateClass = "border-red-500 bg-red-500/10";
                }

                return (
                  <button
                    key={i}
                    onClick={() => submitAnswer(i)}
                    className={`block w-full text-left px-4 py-3 rounded-2xl border transition ${stateClass}`}
                    disabled={reveal}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            <div className="pt-4 flex justify-end">
              <Button onClick={nextQuestion} disabled={!allAnswered}>
                {allAnswered ? "Далее" : `Ожидание (${answeredCount}/${totalPlayers})`}
              </Button>
            </div>
          </div>
        </div>

        {/* Очки */}
        <footer className="bg-gray-900 border border-gray-800 rounded-3xl p-4">
          <h3 className="text-sm text-gray-400 mb-2">Очки</h3>
          <div className="flex gap-3 flex-wrap">
            {Object.entries(players).map(([name, p]) => (
              <span key={name} className="bg-gray-800 px-3 py-2 rounded-xl">
                {name}: {p.score || 0}
              </span>
            ))}
          </div>
        </footer>
      </div>
    );
  }

  /* ---------- RESULTS ---------- */
  if (room.stage === "results") {
    const entries = Object.entries(room.players || {}).sort(
      (a, b) => (b[1].score || 0) - (a[1].score || 0)
    );
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-6">
        <h1 className="text-3xl font-bold mb-4">Результаты</h1>
        <div className="bg-gray-900 p-6 rounded-3xl border border-gray-800 w-full max-w-md space-y-3">
          {entries.map(([name, data], i) => (
            <div key={name} className="flex justify-between bg-gray-800 rounded-xl px-4 py-3">
              <span>{i + 1}. {name}</span>
              <span>{data.score || 0} балл(ов)</span>
            </div>
          ))}
        </div>
        <p className="text-cyan-400 mt-4">Победитель: {entries[0]?.[0]}</p>

{/* Кнопка перехода на форму */}
<a
  href="https://forms.gle/HeEY1vd9XLe9GE8Q6"
  target="_blank"
  rel="noopener noreferrer"
  className="mt-6 inline-block bg-cyan-500 hover:bg-cyan-400 text-black font-semibold px-6 py-3 rounded-2xl transition"
>
  Пройти короткий опрос
</a>
      </div>
    );
  }

  return null;
}

/* (Не обязательно) предзагрузка одной модели для тёплого кэша */
useGLTF.preload("/organs/human_brain.glb");
