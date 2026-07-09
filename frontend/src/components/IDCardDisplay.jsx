export default function IDCardDisplay({ student }) {
  return (
    <div className="id-card">
      <div className="id-card-header">
        Liberia Medical Students Association &middot; A.M. Dogliotti College of Medicine
      </div>

      <div className="id-card-body">
        <div className="id-card-photo">
          {student.photo_url ? (
            <img src={student.photo_url} alt={student.full_name} />
          ) : (
            <span>Photo</span>
          )}
        </div>

        <div className="id-card-info">
          <div className="id-card-name">{student.full_name}</div>
          <div className="id-card-year">{student.year_level} &middot; MBBS Programme</div>
          <div className="id-card-id">{student.student_id}</div>
        </div>
      </div>

      <div className="id-card-footer">
        <span className="id-card-validity">Valid: 2024 – 2025 Academic Year</span>
        <div className="id-card-qr" title="QR Code placeholder" />
      </div>
    </div>
  )
}
