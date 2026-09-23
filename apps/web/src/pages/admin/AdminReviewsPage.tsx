import { staffReviewsApi } from '../../api/reviews';
import { StaffReviewsPage } from '../../components/staff/StaffReviewsPage';

const api = staffReviewsApi('admin');

export function AdminReviewsPage() {
  return <StaffReviewsPage title="Kiểm duyệt đánh giá" api={api} />;
}
