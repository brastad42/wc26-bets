import TabBar from '../components/TabBar'
import ScrollReset from '../components/ScrollReset'
import AuthGuard from '../components/AuthGuard'

export default function MainLayout({ children }) {
  return (
    <>
      <ScrollReset />
      <AuthGuard>
        {children}
        <TabBar />
      </AuthGuard>
    </>
  )
}