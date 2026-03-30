import express from 'express'
import cors from 'cors'
import { prisma } from './helper/prismaClient.js'

const app = express()
const PORT = 3333

app.use(express.json())
app.use(cors())

app.post('/user', async (req, res) => {
  const user = req.body
  
  let result

  try {
    result = await prisma.user.create({
      data: user
    })
  } catch (error) {
      console.error('Error creating user:', error)
      return res.status(500).json({message: 'Erro ao criar usuário, verifique os dados enviados.'})
  }
  
  if (!result)
    return res.status(400).json({message: 'Erro ao criar usuário'})
  
  return res.json({message: 'Usuário criado com sucesso', user: result})
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

app.listen(PORT, () => {
  console.log(`Server is running http://localhost:${PORT}`)
})