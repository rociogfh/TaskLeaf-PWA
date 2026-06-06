import { useEffect, useMemo, useState } from "react";
import "./App.css";

import {
  saveTask,
  getAllTasks,
  deleteTask,
  queueToOutbox,
  getOutbox,
  deleteOutbox,
} from "./db";

import type { Task } from "./db";
import { askNotify, subscribePush } from "./push";

import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";

import { firestoreDb } from "./firebase";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("Media");
  const [dueDate, setDueDate] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [showForm, setShowForm] = useState(false);

  async function saveTaskInFirebase(task: Task) {
    const docRef = await addDoc(collection(firestoreDb, "entries"), {
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate || null,
      completed: task.completed,
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  }

  async function syncPendingTasks() {
    if (!navigator.onLine) return;

    const pending = await getOutbox();

    for (const item of pending) {
      try {
        if (item.type === "task") {
          const firebaseId = await saveTaskInFirebase(item.payload);

          const syncedTask: Task = {
            ...item.payload,
            firebaseId,
            synced: true,
          };

          await saveTask(syncedTask);

          setTasks((prev) =>
            prev.map((task) =>
              task.id === syncedTask.id ? syncedTask : task
            )
          );

          await deleteOutbox(item.id);
        }
      } catch (error) {
        console.error("Error al sincronizar tarea pendiente:", error);
      }
    }
  }

  useEffect(() => {
    getAllTasks().then((data) =>
      setTasks(data.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0)))
    );

    syncPendingTasks();

    const on = () => {
      setOnline(true);
      syncPendingTasks();
    };

    const off = () => setOnline(false);

    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (!("Notification" in window)) return;

        try {
          await navigator.serviceWorker?.ready;
        } catch {}

        if (Notification.permission === "granted") {
          await subscribePush(import.meta.env.VITE_VAPID_PUBLIC as string);
        } else if (Notification.permission === "default") {
          const ok = await askNotify();

          if (ok) {
            await subscribePush(import.meta.env.VITE_VAPID_PUBLIC as string);
          }
        }
      } catch (e) {
        console.warn("Error al solicitar/activar notificaciones:", e);
      }
    })();
  }, []);

  const completedCount = useMemo(
    () => tasks.filter((t) => t.completed).length,
    [tasks]
  );

  const pendingCount = tasks.length - completedCount;

  const percent = useMemo(
    () => (tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0),
    [tasks, completedCount]
  );

  const highCount = useMemo(
    () => tasks.filter((t) => t.priority === "Alta").length,
    [tasks]
  );

  const mediumCount = useMemo(
    () => tasks.filter((t) => t.priority === "Media").length,
    [tasks]
  );

  const lowCount = useMemo(
    () => tasks.filter((t) => t.priority === "Baja").length,
    [tasks]
  );

  async function addTask(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) return;

    const localId = Date.now();

    let newTask: Task = {
      id: localId,
      title: title.trim(),
      description: description.trim(),
      completed: false,
      priority,
      dueDate: dueDate || undefined,
      synced: false,
    };

    setTitle("");
    setDescription("");
    setPriority("Media");
    setDueDate("");
    setShowForm(false);

    if (!navigator.onLine) {
      await saveTask(newTask);
      await queueToOutbox({ type: "task", payload: newTask });

      setTasks((prev) => [newTask, ...prev]);

      try {
        const reg = await navigator.serviceWorker.ready;
        // @ts-ignore
        reg.sync?.register?.("sync-entries");
      } catch (error) {
        console.warn("No se pudo registrar Background Sync:", error);
      }

      return;
    }

    try {
      const firebaseId = await saveTaskInFirebase(newTask);

      newTask = {
        ...newTask,
        firebaseId,
        synced: true,
      };

      await saveTask(newTask);
      setTasks((prev) => [newTask, ...prev]);

      console.log("Tarea guardada en Firebase");
    } catch (error) {
      console.error("Error al guardar en Firebase:", error);

      await saveTask(newTask);
      await queueToOutbox({ type: "task", payload: newTask });
      setTasks((prev) => [newTask, ...prev]);
    }
  }

  async function toggleTask(i: number) {
    const copy = [...tasks];
    const task = copy[i];

    const updatedTask: Task = {
      ...task,
      completed: !task.completed,
    };

    copy[i] = updatedTask;
    setTasks(copy);
    await saveTask(updatedTask);

    if (navigator.onLine && updatedTask.firebaseId) {
      try {
        await updateDoc(doc(firestoreDb, "entries", updatedTask.firebaseId), {
          completed: updatedTask.completed,
        });
      } catch (error) {
        console.error("Error al actualizar tarea en Firebase:", error);
      }
    }
  }

  async function removeTask(i: number) {
  const task = tasks[i];

  if (!task.id) return;

  setTasks((prev) => prev.filter((_, index) => index !== i));
  await deleteTask(task.id);

  if (navigator.onLine && task.firebaseId) {
    try {
      await deleteDoc(doc(firestoreDb, "entries", task.firebaseId));
      console.log("Tarea eliminada de Firebase");
    } catch (error) {
      console.error("Error al eliminar tarea en Firebase:", error);
    }
  }
}

  function formatDate(date?: string) {
    if (!date) return "";

    try {
      return new Date(date + "T00:00:00").toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return date;
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-icon">✓</div>
          <div>
            <h1 className="brand-title">Bienvenido a TaskLeaf</h1>
            <p className="brand-subtitle">Organiza tus tareas con estilo</p>
          </div>
        </div>

        <div className="topbar-stats">
          <div className="stat-pill">
            <span className="stat-number">{pendingCount}</span>
            <span className="stat-label">Pendientes</span>
          </div>

          <div className="stat-pill">
            <span className="stat-number">{completedCount}</span>
            <span className="stat-label">Completadas</span>
          </div>

          <button
            className="add-btn"
            onClick={() => setShowForm((prev) => !prev)}
            type="button"
            aria-label="Agregar tarea"
          >
            +
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <div className="sidebar-card">
            <h2 className="sidebar-title">Resumen</h2>

            <div className="summary-list">
              <div className="summary-row">
                <span>Total de tareas</span>
                <strong>{tasks.length}</strong>
              </div>

              <div className="summary-row">
                <span>Pendientes</span>
                <strong>{pendingCount}</strong>
              </div>

              <div className="summary-row">
                <span>Completadas</span>
                <strong>{completedCount}</strong>
              </div>

              <div className="summary-row">
                <span>Progreso</span>
                <strong>{percent}%</strong>
              </div>
            </div>

            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${percent}%` }} />
            </div>
          </div>

          <div className="sidebar-card">
            <h2 className="sidebar-title">Prioridad</h2>

            <div className="priority-summary">
              <div className="priority-summary-item priority-high">
                <span>Alta</span>
                <strong>{highCount}</strong>
              </div>

              <div className="priority-summary-item priority-medium">
                <span>Media</span>
                <strong>{mediumCount}</strong>
              </div>

              <div className="priority-summary-item priority-low">
                <span>Baja</span>
                <strong>{lowCount}</strong>
              </div>
            </div>
          </div>
        </aside>

        <section className="board">
          {showForm && (
            <section className="task-form-panel">
              <div className="panel-head">
                <div>
                  <h2>Nueva tarea</h2>
                  <p>Agrega una actividad a tu lista</p>
                </div>

                <button
                  type="button"
                  className="panel-close"
                  onClick={() => setShowForm(false)}
                >
                  ×
                </button>
              </div>

              <form className="task-form" onSubmit={addTask}>
                <input
                  className="task-input"
                  placeholder="Título de la tarea"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />

                <textarea
                  className="task-input task-textarea"
                  placeholder="Descripción"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />

                <div className="form-grid">
                  <select
                    className="task-input"
                    value={priority}
                    onChange={(e) =>
                      setPriority(e.target.value as Task["priority"])
                    }
                  >
                    <option value="Alta">Alta</option>
                    <option value="Media">Media</option>
                    <option value="Baja">Baja</option>
                  </select>

                  <input
                    className="task-input"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setShowForm(false)}
                  >
                    Cancelar
                  </button>

                  <button type="submit" className="btn-primary">
                    Guardar tarea
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="tasks-panel">
            <div className="tasks-panel-head">
              <div>
                <h2 className="tasks-title">Today</h2>
                <p className="tasks-subtitle">
                  {tasks.length === 0
                    ? "No hay tareas registradas"
                    : `${tasks.length} tarea(s) registradas`}
                </p>
              </div>

              <span
                className={`online-badge ${online ? "is-online" : "is-offline"}`}
              >
                {online ? "Online" : "Offline"}
              </span>
            </div>

            {tasks.length === 0 ? (
              <div className="empty-state">
                <h3>Aún no hay tareas</h3>
                <p>Presiona el botón + para agregar una nueva tarea.</p>
              </div>
            ) : (
              <ul className="task-list">
                {tasks.map((t, i) => (
                  <li key={t.id ?? i} className="task-row">
                    <label className="check-circle">
                      <input
                        type="checkbox"
                        checked={t.completed}
                        onChange={() => toggleTask(i)}
                      />
                      <span />
                    </label>

                    <div className="task-main">
                      <div className="task-main-top">
                        <div className="task-title-block">
                          <h3
                            className={`task-title ${
                              t.completed ? "done" : ""
                            }`}
                          >
                            {t.title}
                          </h3>

                          {t.description && (
                            <p className="task-description">{t.description}</p>
                          )}
                        </div>

                        <div className="task-side-tags">
  <span
    className={`state-badge ${
      t.completed ? "state-done" : "state-pending"
    }`}
  >
    {t.completed ? "Completada" : "Pendiente"}
  </span>

  <button
    type="button"
    className="delete-btn"
    onClick={() => removeTask(i)}
  >
    Eliminar
  </button>
</div>
                      </div>

                      <div className="task-meta">
  <span
    className={`priority-badge ${
      t.priority === "Alta"
        ? "priority-badge-high"
        : t.priority === "Media"
        ? "priority-badge-medium"
        : "priority-badge-low"
    }`}
  >
    {t.priority}
  </span>

  {t.dueDate && (
    <span className="meta-chip">
      Vence: {formatDate(t.dueDate)}
    </span>
  )}

  <span className="meta-chip">
    {t.synced ? "Sincronizada" : "Local"}
  </span>
</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
