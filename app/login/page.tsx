'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material'
import { useRouter } from 'next/navigation'
import { signIn } from '@/lib/auth-client'
import { loginSchema, type LoginInput } from './schema'

export default function LoginPage() {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginInput) {
    setFormError(null)
    const result = await signIn.email(values)
    if (result.error) {
      setFormError(result.error.message ?? 'Sign-in failed')
      return
    }
    router.push('/admin')
    router.refresh()
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Paper sx={{ p: 4, width: 360 }}>
        <Typography
          variant="h5"
          align="center"
          gutterBottom
        >
          weplay studios
        </Typography>
        <Box
          component="form"
          noValidate
          onSubmit={handleSubmit(onSubmit)}
        >
          {formError && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
            >
              {formError}
            </Alert>
          )}
          <TextField
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            error={Boolean(errors.email)}
            helperText={errors.email?.message}
            {...register('email')}
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            margin="normal"
            error={Boolean(errors.password)}
            helperText={errors.password?.message}
            {...register('password')}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            sx={{ mt: 2 }}
            disabled={isSubmitting}
          >
            Sign in
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}
