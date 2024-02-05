import Execution from '@/models/execution'
import User from '@/models/user'

const getPlumberStats = async () => {
  const userCount = await User.query().resultSize()
  const executionCount = await Execution.query().resultSize()
  return {
    userCount,
    executionCount,
  }
}

export default getPlumberStats
