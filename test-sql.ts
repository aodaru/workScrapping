import Database from 'better-sqlite3'

const db = new Database("jobs.db")

db.exec(`
  CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL, 
    company TEXT NOT NULL,
    modality TEXT NOT NULL
  )
`)

const insert = db.prepare(
  'INSERT INTO jobs (id, title, company, modality) VALUES (?, ?, ?, ?)'
)

insert.run('1', 'Frontend Developer', 'TechCorp', 'remote')
insert.run('2', 'Backend Developer', 'StartupX', 'hybrid')

const allJobs = db.prepare('SELECT * FROM jobs').all()
console.log('Todos los jobs:', allJobs)

const remoteJobs = db.prepare('SElECT * FROM jobs WHERE modality = ?').all('remote')
console.log('Jobs remotos:', remoteJobs)

const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get('1')
console.log('Jobid 1:', job)

// Actualizar
db.prepare('UPDATE jobs SET modality = ? WHERE id = ?').run('outsite', '1')

// Eliminar
const result = db.prepare('DELETE FROM jobs WHERE id = ?').run('2')
console.log('Filas eliminadas: ', result.changes)

db.close()
