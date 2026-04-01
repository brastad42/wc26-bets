import TabBar from '../components/TabBar'

export default function MainLayout({ children }) {
  return (
    <>
      {children}
      <TabBar />
    </>
  )
}