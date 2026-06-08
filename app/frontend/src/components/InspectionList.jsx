// report_url が実ファイルパスを指していれば「保存済みPDFあり」とみなす
const hasStoredPdf = (insp) => typeof insp.report_url === 'string' && insp.report_url.startsWith('reports/')

function InspectionList({ inspections, isLoading, onEdit, onDelete, onView, onGeneratePdf, onViewPdf, pdfBusyId, projects = [], staff = [] }) {
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]))
  const staffMap = Object.fromEntries(staff.map(s => [s.id, s.name]))
  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
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
      case 'completed':
        return '✔ 完了'
      case 'pending':
      default:
        return '⏳ 未確認'
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    try {
      return new Date(dateStr).toLocaleDateString('ja-JP')
    } catch {
      return dateStr
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
    <div className="space-y-4">
      <div className="text-sm text-gray-600">全 {inspections.length} 件</div>
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">日付</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">現場</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">検査員</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">指摘カテゴリ</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">ステータス</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {inspections.map((inspection) => {
              const hasIssues = Array.isArray(inspection.categories) && inspection.categories.length > 0
              return (
                <tr
                  key={inspection.id}
                  className="hover:bg-gray-50 transition cursor-pointer"
                  onClick={() => onView && onView(inspection.id)}
                >
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {formatDate(inspection.inspection_date)}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {projectMap[inspection.project_id] || inspection.project_id || '-'}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {staffMap[inspection.inspector_id] || inspection.inspector_id || '-'}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    {hasIssues ? (
                      <div className="flex flex-wrap gap-1">
                        {inspection.categories.map(cat => (
                          <span key={cat} className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                            {cat}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-green-600 text-xs font-medium">指摘なし</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(inspection.status)}`}>
                      {getStatusLabel(inspection.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm" onClick={e => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => onView && onView(inspection.id)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition"
                      >
                        詳細
                      </button>
                      {inspection.report_url ? (
                        <button
                          disabled
                          title="PDF生成済みのため編集できません"
                          className="px-3 py-1.5 text-xs font-medium text-gray-400 border border-gray-200 rounded cursor-not-allowed"
                        >
                          🔒 編集
                        </button>
                      ) : (
                        <button
                          onClick={() => onEdit(inspection.id)}
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50 transition"
                        >
                          編集
                        </button>
                      )}
                      {hasStoredPdf(inspection) ? (
                        <button
                          onClick={() => onViewPdf && onViewPdf(inspection.id)}
                          className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-300 rounded hover:bg-purple-100 transition"
                        >
                          📄 PDF表示
                        </button>
                      ) : (
                        <button
                          onClick={() => onGeneratePdf && onGeneratePdf(inspection.id)}
                          disabled={pdfBusyId === inspection.id}
                          className="px-3 py-1.5 text-xs font-medium text-purple-600 border border-purple-300 rounded hover:bg-purple-50 transition disabled:opacity-50 disabled:cursor-wait"
                        >
                          {pdfBusyId === inspection.id ? '生成中…' : '📄 PDF生成'}
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(inspection.id)}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-300 rounded hover:bg-red-50 transition"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default InspectionList
