import express from 'express'
import cors from 'cors'
import { prisma } from './helper/prismaClient.js'

const app = express()
const PORT = 3000

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

app.listen(PORT, () => {
  console.log(`Server is running http://localhost:${PORT}`)
})