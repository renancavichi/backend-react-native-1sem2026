import { jest } from '@jest/globals'
import { createServer } from 'http'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

process.env.JWT_SECRET = 'test-secret-key'

jest.unstable_mockModule('../helper/prismaClient.js', () => ({
  prisma: {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

const { app } = await import('../server.js')
const { prisma } = await import('../helper/prismaClient.js')

const makeToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1d' })

const mockUser = { id: 1, name: 'Test User', email: 'test@example.com', pass: 'hashed' }
const mockUserNoPass = { id: 1, name: 'Test User', email: 'test@example.com' }

let server
beforeAll(() => {
  server = createServer(app)
  server.listen(0)
})
afterAll(() => new Promise((resolve) => server.close(resolve)))
afterEach(() => jest.clearAllMocks())

// ---------------------------------------------------------------------------
// POST /user
// ---------------------------------------------------------------------------
describe('POST /user', () => {
  test('200 – cria usuário com sucesso e omite o campo pass', async () => {
    prisma.user.create.mockResolvedValueOnce(mockUser)

    const res = await request(server)
      .post('/user')
      .send({ name: 'Test User', email: 'test@example.com', pass: 'password123' })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Usuário criado com sucesso')
    expect(res.body.user).toEqual(mockUserNoPass)
    expect(res.body.user.pass).toBeUndefined()
  })

  test('500 – erro do banco de dados', async () => {
    prisma.user.create.mockRejectedValueOnce(new Error('DB error'))

    const res = await request(server)
      .post('/user')
      .send({ name: 'Test User', email: 'test@example.com', pass: 'password123' })

    expect(res.status).toBe(500)
    expect(res.body.message).toBe('Erro ao criar usuário, verifique os dados enviados.')
  })
})

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------
describe('POST /login', () => {
  test('200 – login com sucesso, retorna user e token', async () => {
    const hashedPass = await bcrypt.hash('password123', 1)
    prisma.user.findUnique.mockResolvedValueOnce({ ...mockUser, pass: hashedPass })

    const res = await request(server)
      .post('/login')
      .send({ email: 'test@example.com', pass: 'password123' })

    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
    expect(res.body.user).toEqual(mockUserNoPass)
    expect(res.body.user.pass).toBeUndefined()
  })

  test('401 – e-mail não encontrado', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null)

    const res = await request(server)
      .post('/login')
      .send({ email: 'nope@example.com', pass: 'password123' })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('E-mail ou senha inválidos')
  })

  test('401 – senha incorreta', async () => {
    const hashedPass = await bcrypt.hash('correct-password', 1)
    prisma.user.findUnique.mockResolvedValueOnce({ ...mockUser, pass: hashedPass })

    const res = await request(server)
      .post('/login')
      .send({ email: 'test@example.com', pass: 'wrong-password' })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('E-mail ou senha inválidos')
  })

  test('500 – erro do banco de dados', async () => {
    prisma.user.findUnique.mockRejectedValueOnce(new Error('DB error'))

    const res = await request(server)
      .post('/login')
      .send({ email: 'test@example.com', pass: 'password123' })

    expect(res.status).toBe(500)
    expect(res.body.message).toBe('Erro ao realizar login')
  })
})

// ---------------------------------------------------------------------------
// GET /user
// ---------------------------------------------------------------------------
describe('GET /user', () => {
  test('200 – lista usuários com sucesso', async () => {
    prisma.user.findMany.mockResolvedValueOnce([mockUser])

    const res = await request(server).get('/user')

    expect(res.status).toBe(200)
    expect(res.body.users).toEqual([mockUser])
  })

  test('500 – erro do banco de dados', async () => {
    prisma.user.findMany.mockRejectedValueOnce(new Error('DB error'))

    const res = await request(server).get('/user')

    expect(res.status).toBe(500)
    expect(res.body.message).toBe('Erro ao buscar usuários')
  })
})

// ---------------------------------------------------------------------------
// GET /user/:id  (requer Bearer Token)
// ---------------------------------------------------------------------------
describe('GET /user/:id', () => {
  test('200 – retorna usuário sem o campo pass', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(mockUser)
    const token = makeToken(1)

    const res = await request(server)
      .get('/user/1')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.user).toEqual(mockUserNoPass)
    expect(res.body.user.pass).toBeUndefined()
  })

  test('401 – token não fornecido', async () => {
    const res = await request(server).get('/user/1')

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Token não fornecido')
  })

  test('401 – token inválido', async () => {
    const res = await request(server)
      .get('/user/1')
      .set('Authorization', 'Bearer invalid.token.here')

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Token inválido ou expirado')
  })

  test('403 – token de outro usuário', async () => {
    const token = makeToken(99)

    const res = await request(server)
      .get('/user/1')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
    expect(res.body.message).toBe('Não autorizado')
  })

  test('404 – usuário não encontrado', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null)
    const token = makeToken(1)

    const res = await request(server)
      .get('/user/1')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
    expect(res.body.message).toBe('Usuário não encontrado')
  })

  test('500 – erro do banco de dados', async () => {
    prisma.user.findUnique.mockRejectedValueOnce(new Error('DB error'))
    const token = makeToken(1)

    const res = await request(server)
      .get('/user/1')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(500)
    expect(res.body.message).toBe('Erro ao buscar usuário')
  })
})

// ---------------------------------------------------------------------------
// PUT /user/:id
// ---------------------------------------------------------------------------
describe('PUT /user/:id', () => {
  test('200 – atualiza usuário com sucesso', async () => {
    const updated = { ...mockUser, name: 'Updated Name' }
    prisma.user.update.mockResolvedValueOnce(updated)

    const res = await request(server)
      .put('/user/1')
      .send({ name: 'Updated Name' })

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Usuário atualizado com sucesso')
    expect(res.body.user).toEqual(updated)
  })

  test('500 – erro do banco de dados', async () => {
    prisma.user.update.mockRejectedValueOnce(new Error('DB error'))

    const res = await request(server)
      .put('/user/1')
      .send({ name: 'Updated Name' })

    expect(res.status).toBe(500)
    expect(res.body.message).toBe('Erro ao atualizar usuário')
  })
})

// ---------------------------------------------------------------------------
// DELETE /user/:id
// ---------------------------------------------------------------------------
describe('DELETE /user/:id', () => {
  test('200 – remove usuário com sucesso', async () => {
    prisma.user.delete.mockResolvedValueOnce(mockUser)

    const res = await request(server).delete('/user/1')

    expect(res.status).toBe(200)
    expect(res.body.message).toBe('Usuário deletado com sucesso')
    expect(res.body.user).toEqual(mockUser)
  })

  test('500 – erro do banco de dados', async () => {
    prisma.user.delete.mockRejectedValueOnce(new Error('DB error'))

    const res = await request(server).delete('/user/1')

    expect(res.status).toBe(500)
    expect(res.body.message).toBe('Erro ao deletar usuário')
  })
})
