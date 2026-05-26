import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from './helper/prismaClient.js'

const JWT_SECRET = process.env.JWT_SECRET

const app = express()
const PORT = 3333

app.use(express.json())
app.use(cors())

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token)
    return res.status(401).json({ message: 'Token não fornecido' })

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.userId = decoded.id
    next()
  } catch {
    return res.status(401).json({ message: 'Token inválido ou expirado' })
  }
}

app.post('/user', async (req, res) => {
  const { pass, ...rest } = req.body

  const hashedPass = await bcrypt.hash(pass, 10)

  let result

  try {
    result = await prisma.user.create({
      data: { ...rest, pass: hashedPass }
    })
  } catch (error) {
      console.error('Error creating user:', error)
      return res.status(500).json({message: 'Erro ao criar usuário, verifique os dados enviados.'})
  }
  
  if (!result)
    return res.status(400).json({message: 'Erro ao criar usuário'})
  
  const { pass: _, ...userWithoutPass } = result
  return res.json({message: 'Usuário criado com sucesso', user: userWithoutPass})
})

app.post('/login', async (req, res) => {
  const { email, pass } = req.body

  let user

  try {
    user = await prisma.user.findUnique({ where: { email } })
  } catch (error) {
    console.error('Error finding user:', error)
    return res.status(500).json({ message: 'Erro ao realizar login' })
  }

  if (!user)
    return res.status(401).json({ message: 'E-mail ou senha inválidos' })

  const passwordMatch = await bcrypt.compare(pass, user.pass)

  if (!passwordMatch)
    return res.status(401).json({ message: 'E-mail ou senha inválidos' })

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1d' })

  const { pass: _, ...userWithoutPass } = user

  return res.json({ user: userWithoutPass, token })
})


app.get('/user/:id', authMiddleware, async (req, res) => {
  const { id } = req.params

  if (req.userId !== parseInt(id))
    return res.status(403).json({ message: 'Não autorizado' })

  let user

  try {
    user = await prisma.user.findUnique({ where: { id: parseInt(id) } })
  } catch (error) {
    console.error('Error fetching user:', error)
    return res.status(500).json({ message: 'Erro ao buscar usuário' })
  }

  if (!user)
    return res.status(404).json({ message: 'Usuário não encontrado' })

  const { pass: _, ...userWithoutPass } = user

  return res.json({ user: userWithoutPass })
})


app.get('/user', async (req, res) => {
  let result

  try {
    result = await prisma.user.findMany()
  } catch (error) {
    console.error('Error fetching users:', error)
    return res.status(500).json({message: 'Erro ao buscar usuários'})
  }

  return res.json({users: result})
})

app.delete('/user/:id', async (req, res) => {
  const { id } = req.params
  let result

  try {
    result = await prisma.user.delete({
      where: { id: parseInt(id) }
    })
  } catch (error) {
    console.error('Error deleting user:', error)
    return res.status(500).json({message: 'Erro ao deletar usuário'})
  }

  return res.json({message: 'Usuário deletado com sucesso', user: result})
})

app.put('/user/:id', async (req, res) => {
  const { id } = req.params
  const user = req.body
  let result

  try {
    result = await prisma.user.update({
      where: { id: +id },
      data: user
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return res.status(500).json({message: 'Erro ao atualizar usuário'})
  }

  return res.json({message: 'Usuário atualizado com sucesso', user: result})
})

import { fileURLToPath } from 'url'

const isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (isMain) {
  app.listen(PORT, () => {
    console.log(`Server is running http://localhost:${PORT}`)
  })
}

export { app }