function InspectionList({ inspections, isLoading, onEdit, onDelete }) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'approved':
        return '✓ 承認済み'
      case 'rejected':
        return '✗ 要修正'
      case 'pending':
      default:
        return '⏳ 未確認'
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">⏳</div>
        <p className="text-gray-600">読み込み中...</p>
      </div>
    )
  }

  if (inspections.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="text-6xl mb-4">📭</div>
        <p className="text-gray-600 text-lg">まだ点検記録がありません</p>
        <p className="text-gray-500 text-sm">新規点検タブから記録を追加してください</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">点検ID</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">日付</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">検査員</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">場所</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">完了項目</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">ステータス</th>
            <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {inspections.map((inspection) => (
            <tr key={inspection.id} className="hover:bg-gray-50 transition">
              <td className="px-6 py-4 text-sm font-medium text-gray-900">
                {inspection.inspectionId}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {new Date(inspection.date).toLocaleDateString('ja-JP')}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {inspection.inspectorName}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {inspection.location}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {Object.values(inspection.checkedItems || {}).filter(Boolean).length}/{
                  Object.keys(inspection.checkedItems || {}).length || 0
                }
              </td>
              <td className="px-6 py-4 text-sm">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(inspection.status)}`}>
                  {getStatusLabel(inspection.status)}
                </span>
              </td>
              <td className="px-6 py-4 text-sm">
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(inspection.id)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => onDelete(inspection.id)}
                    className="text-red-600 hover:text-red-800 font-medium"
                  >
                    削除
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default InspectionList
