import { Suspense } from 'react'
import LoginForm from './login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Suspense fallback={
        <div className="w-full max-w-sm bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="h-8 w-24 bg-gray-100 rounded animate-pulse mb-6" />
          <div className="space-y-4">
            <div className="h-10 bg-gray-100 rounded animate-pulse" />
            <div className="h-10 bg-gray-100 rounded animate-pulse" />
            <div className="h-10 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  )
}
