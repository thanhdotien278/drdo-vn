import { staffReviewsApi } from '../api/reviews';
import { StaffReviewsPage } from '../components/staff/StaffReviewsPage';

const api = staffReviewsApi('employee');

export function EmployeeReviewsPage() {
  return <StaffReviewsPage title="Kiểm duyệt đánh giá — Nhân viên" api={api} />;
}
