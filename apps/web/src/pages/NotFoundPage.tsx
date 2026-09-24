import { Link } from 'react-router-dom';
import { PageContainer } from '../components/PageContainer';

export function NotFoundPage() {
  return (
    <PageContainer className="page">
      <div className="state-block">
        <p className="state-block__title">Không tìm thấy trang</p>
        <p className="state-block__description">
          Đường dẫn bạn truy cập không tồn tại hoặc đã được thay đổi.
        </p>
        <Link className="button button--primary" to="/">
          Về trang chủ
        </Link>
      </div>
    </PageContainer>
  );
}
