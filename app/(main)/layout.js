import TabBar from '../components/TabBar'
import ScrollReset from '../components/ScrollReset'

export default function MainLayout({ children }) {
  return (
    <>
      <ScrollReset />
      {children}
      <TabBar />
    </>
  )
}