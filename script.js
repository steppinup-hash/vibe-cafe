// ==========================================================================
// 바이브 카페 (Vibe Cafe) - 주문서 및 주문 내역 자바스크립트 (script.js)
// ==========================================================================

// ==========================================================================
// [Supabase 설정] 프로젝트 URL 및 API Key를 여기에 입력하세요.
// ==========================================================================
const SUPABASE_URL = 'https://frihisqzkcwxrlcjifki.supabase.co'; // 예: 'https://your-project-id.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyaWhpc3F6a2N3eHJsY2ppZmtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MDU1MTAsImV4cCI6MjEwNjk4MTUxMH0.RadeWLtgDqlIiEWq_gKENc6uYjP7DwibGsWXoDhf2Ro'; // 예: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'

// Supabase 클라이언트 초기화 (CDN으로 로드된 window.supabase 사용)
const supabaseClient = (window.supabase && SUPABASE_URL && SUPABASE_KEY) 
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) 
  : (window.supabase ? window.supabase.createClient(SUPABASE_URL || 'https://placeholder.supabase.co', SUPABASE_KEY || 'placeholder') : null);

// 문서(DOM)가 모두 준비되면 코드를 실행합니다.
document.addEventListener('DOMContentLoaded', () => {

  // --------------------------------------------------------------------------
  // 1. 필요한 HTML 요소들을 가져옵니다.
  // --------------------------------------------------------------------------
  // [탭 관련 요소]
  const tabOrder = document.getElementById('tabOrder');
  const tabHistory = document.getElementById('tabHistory');
  const orderSection = document.getElementById('orderSection');
  const historySection = document.getElementById('historySection');
  const orderCountBadge = document.getElementById('orderCountBadge');

  // [주문서 폼 관련 요소]
  const orderForm = document.getElementById('orderForm');
  const userNameInput = document.getElementById('userName');
  const userPhoneInput = document.getElementById('userPhone');
  const drinkSelect = document.getElementById('drinkSelect');
  const sizeRadios = document.querySelectorAll('input[name="size"]');
  const optionCheckboxes = document.querySelectorAll('input[name="option"]');
  const quantityInput = document.getElementById('quantity');
  const requestsInput = document.getElementById('requests');
  const totalPriceSpan = document.getElementById('totalPrice');
  const submitBtn = document.getElementById('submitBtn');
  const resetBtn = document.getElementById('resetBtn');
  const orderConfirmation = document.getElementById('orderConfirmation');

  // [주문 내역 관련 요소]
  const orderList = document.getElementById('orderList');
  const historyFooter = document.getElementById('historyFooter');
  const historySummary = document.getElementById('historySummary');
  const drinkSummary = document.getElementById('drinkSummary');
  const clearAllBtn = document.getElementById('clearAllBtn');

  // --------------------------------------------------------------------------
  // 2. 주문 데이터 상태 관리 변수
  // --------------------------------------------------------------------------
  let orders = [];       // 접수된 주문 객체들을 보관하는 배열
  let orderSeqCounter = 1; // 주문 번호 발급을 위한 1부터 시작하는 카운터

  // ==========================================================================
  // [함수 1] 예상 금액 계산 및 화면 업데이트 (calculateTotal)
  // ==========================================================================
  function calculateTotal() {
    // 1) 음료 선택 확인
    const selectedOption = drinkSelect.options[drinkSelect.selectedIndex];
    
    // 음료를 선택하지 않았거나 빈 값인 경우 0원으로 표시
    if (!drinkSelect.value || !selectedOption) {
      totalPriceSpan.textContent = '0';
      return 0;
    }

    // 음료 기본 가격 읽기 (data-price 속성)
    const drinkPrice = parseInt(selectedOption.dataset.price, 10) || 0;

    // 2) 선택된 사이즈 추가 금액 읽기
    let sizePrice = 0;
    const selectedSize = document.querySelector('input[name="size"]:checked');
    if (selectedSize) {
      sizePrice = parseInt(selectedSize.dataset.price, 10) || 0;
    }

    // 3) 선택된 추가 옵션 금액 합산하기
    let optionPrice = 0;
    optionCheckboxes.forEach((checkbox) => {
      if (checkbox.checked) {
        optionPrice += parseInt(checkbox.dataset.price, 10) || 0;
      }
    });

    // 4) 수량 읽기 (최소 1 보정)
    let quantity = parseInt(quantityInput.value, 10);
    if (isNaN(quantity) || quantity < 1) {
      quantity = 1;
    }

    // 5) 1잔당 단가 및 총 금액 계산: (음료 + 사이즈 + 옵션합) * 수량
    const unitPrice = drinkPrice + sizePrice + optionPrice;
    const totalPrice = unitPrice * quantity;

    // 6) 천 단위 콤마(toLocaleString) 적용 후 화면에 반영
    totalPriceSpan.textContent = totalPrice.toLocaleString();

    return totalPrice;
  }

  // ==========================================================================
  // [함수 2] 주문 내역 렌더링 함수 (renderOrders)
  // ==========================================================================
  function renderOrders() {
    // 1) 탭 옆의 주문 건수 배지 숫자 업데이트
    orderCountBadge.textContent = orders.length;

    // 2) 기존 목록 화면 비우기
    orderList.textContent = '';

    // 3) 주문 내역이 하나도 없을 때
    if (orders.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-history-msg';
      emptyMsg.textContent = '아직 주문 내역이 없어요 ☕';
      orderList.appendChild(emptyMsg);

      // 하단 요약 및 전체 삭제 버튼 숨기기
      historyFooter.hidden = true;
      return;
    }

    // 4) 주문 내역이 있을 때 하단 푸터 표시
    historyFooter.hidden = false;

    // 5) 총 주문 금액 및 총 건수 계산
    const totalOrderAmount = orders.reduce((sum, item) => sum + item.totalPrice, 0);
    historySummary.textContent = `총 주문 금액: ${totalOrderAmount.toLocaleString()}원 (${orders.length}건)`;

    // 6) 음료별 누적 판매 잔수 집계 (예: "카페라떼 3잔, 아메리카노 1잔")
    const drinkCounts = {};
    orders.forEach((item) => {
      drinkCounts[item.drinkName] = (drinkCounts[item.drinkName] || 0) + item.quantity;
    });

    const drinkSummaryText = Object.entries(drinkCounts)
      .map(([drink, count]) => `${drink} ${count}잔`)
      .join(', ');

    drinkSummary.textContent = drinkSummaryText ? `판매 현황: ${drinkSummaryText}` : '';

    // 7) 주문 카드 요소들을 하나씩 생성하여 화면에 추가
    orders.forEach((order) => {
      // 카드 전체 컨테이너 생성
      const card = document.createElement('div');
      card.className = 'order-card';

      // [오른쪽 위 취소 버튼]
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'order-cancel-btn';
      cancelBtn.textContent = '취소';
      // 취소 버튼 클릭 시 확인 후 해당 주문 삭제
      cancelBtn.addEventListener('click', () => {
        const isConfirmed = confirm(`#${order.orderNumber} ${order.userName}님의 주문을 취소하시겠습니까?`);
        if (isConfirmed) {
          // 배열에서 해당 주문 ID를 찾아서 제거
          orders = orders.filter((item) => item.id !== order.id);
          // 화면 다시 렌더링
          renderOrders();
        }
      });
      card.appendChild(cancelBtn);

      // [1줄: "#1 홍길동님 · 5,000원"]
      // ※ 보안을 위해 사용자가 입력한 이름은 반드시 textContent로 안전하게 삽입
      const headerDiv = document.createElement('div');
      headerDiv.className = 'order-card-header';
      headerDiv.textContent = `#${order.orderNumber} ${order.userName}님 · ${order.totalPrice.toLocaleString()}원`;
      card.appendChild(headerDiv);

      // [2줄: "카페라떼 M사이즈 (샷 추가) 1잔"]
      const bodyDiv = document.createElement('div');
      bodyDiv.className = 'order-card-body';
      const optionText = order.optionNames.length > 0 ? ` (${order.optionNames.join(', ')})` : '';
      bodyDiv.textContent = `${order.drinkName} ${order.sizeName}사이즈${optionText} ${order.quantity}잔`;
      card.appendChild(bodyDiv);

      // [3줄: 요청사항(있을 때만) · 주문 시간]
      const footerDiv = document.createElement('div');
      footerDiv.className = 'order-card-footer';
      if (order.requests) {
        footerDiv.textContent = `요청: ${order.requests} · ${order.orderTime}`;
      } else {
        footerDiv.textContent = `${order.orderTime}`;
      }
      card.appendChild(footerDiv);

      // 목록에 카드 추가
      orderList.appendChild(card);
    });
  }

  // ==========================================================================
  // [함수 3] 탭 전환 함수
  // ==========================================================================
  function switchTab(targetTab) {
    if (targetTab === 'order') {
      // 1) 주문하기 탭 활성화
      tabOrder.classList.add('active');
      tabHistory.classList.remove('active');
      orderSection.hidden = false;
      historySection.hidden = true;
    } else if (targetTab === 'history') {
      // 2) 주문 내역 탭 활성화
      tabHistory.classList.add('active');
      tabOrder.classList.remove('active');
      orderSection.hidden = true;
      historySection.hidden = false;
      // 주문 내역 화면 최신 상태로 렌더링
      renderOrders();
    }
  }

  // 탭 클릭 이벤트 연결
  tabOrder.addEventListener('click', () => switchTab('order'));
  tabHistory.addEventListener('click', () => switchTab('history'));

  // ==========================================================================
  // [이벤트 리스너] 값 변경 시 실시간 금액 계산
  // ==========================================================================
  drinkSelect.addEventListener('change', calculateTotal);
  sizeRadios.forEach((radio) => radio.addEventListener('change', calculateTotal));
  optionCheckboxes.forEach((checkbox) => checkbox.addEventListener('change', calculateTotal));
  quantityInput.addEventListener('input', calculateTotal);
  quantityInput.addEventListener('change', calculateTotal);

  // ==========================================================================
  // [이벤트 리스너] 주문하기 (Submit) 처리 및 Supabase 데이터베이스 저장
  // ==========================================================================
  orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1) 이름 유효성 검사 (필수)
    const userName = userNameInput.value.trim();
    if (!userName) {
      alert('이름을 입력해주세요');
      userNameInput.focus();
      return;
    }

    // 2) 음료 선택 유효성 검사 (필수)
    if (!drinkSelect.value) {
      alert('음료를 선택해주세요');
      drinkSelect.focus();
      return;
    }

    // 3) 금액 계산
    const finalTotal = calculateTotal();

    // 4) 선택된 음료 정보 추출
    const selectedOption = drinkSelect.options[drinkSelect.selectedIndex];
    const drinkPrice = parseInt(selectedOption.dataset.price, 10) || 0; // 음료 단품 가격
    const drinkName = selectedOption.textContent.replace(/\s*\(.*?\)/, '').trim(); // 음료 이름

    // 5) 선택된 사이즈
    const selectedSizeInput = document.querySelector('input[name="size"]:checked');
    const sizeName = selectedSizeInput ? selectedSizeInput.value : 'M';

    // 6) 선택된 추가 옵션 목록 추출 (배열)
    const selectedOptionNames = [];
    optionCheckboxes.forEach((checkbox) => {
      if (checkbox.checked) {
        const label = document.querySelector(`label[for="${checkbox.id}"]`);
        if (label) {
          const optName = label.textContent.replace(/\s*\(.*?\)/, '').trim();
          selectedOptionNames.push(optName);
        }
      }
    });

    // 7) 기타 필드 정보 (전화번호, 수량, 요청사항)
    const userPhone = userPhoneInput.value.trim();
    const quantity = parseInt(quantityInput.value, 10) || 1;
    const requests = requestsInput.value.trim();

    // 8) 중복 클릭 방지: 주문하기 버튼 비활성화
    submitBtn.disabled = true;
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = '주문 처리 중...';

    try {
      // 9) Supabase의 cafe_menu03 테이블에 주문 데이터 저장
      if (supabaseClient && SUPABASE_URL && SUPABASE_KEY) {
        const { data, error } = await supabaseClient
          .from('cafe_menu03')
          .insert([
            {
              customer_name: userName,
              phone: userPhone,
              drink: drinkName,
              drink_price: drinkPrice,
              size: sizeName,
              options: selectedOptionNames, // 배열 형태 저장
              quantity: quantity,
              request: requests,
              total_price: finalTotal
            }
          ]);

        // 에러가 발생한 경우 예외 던지기
        if (error) {
          throw error;
        }
      } else {
        console.warn('Supabase URL 또는 Key가 설정되지 않았습니다. 로컬 테스트 모드로 실행됩니다.');
      }

      // 10) 저장 성공 시: 로컬 주문 내역 배열에 추가
      const orderTime = new Date().toLocaleTimeString('ko-KR', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      const newOrder = {
        id: Date.now() + Math.random(),
        orderNumber: orderSeqCounter++,
        userName: userName,
        drinkName: drinkName,
        sizeName: sizeName,
        optionNames: selectedOptionNames,
        quantity: quantity,
        requests: requests,
        totalPrice: finalTotal,
        orderTime: orderTime
      };

      orders.unshift(newOrder); // 최신 주문을 맨 앞에 추가

      // 배지 건수 갱신 및 바운스 애니메이션 실행
      orderCountBadge.textContent = orders.length;
      orderCountBadge.classList.remove('bounce');
      void orderCountBadge.offsetWidth;
      orderCountBadge.classList.add('bounce');

      // 주문 확인 메시지 표시
      const optionString = selectedOptionNames.length > 0 ? ` (${selectedOptionNames.join(', ')})` : '';
      const confirmationMessage = `${userName}님, ${drinkName} ${sizeName}사이즈${optionString} ${quantity}잔, 총 ${finalTotal.toLocaleString()}원 주문이 접수되었습니다!`;

      orderConfirmation.textContent = confirmationMessage;
      orderConfirmation.hidden = false;
      orderConfirmation.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (err) {
      // 11) 저장 실패 시 에러 처리
      alert('주문 저장에 실패했어요');
      console.error('Supabase 주문 저장 에러:', err);
    } finally {
      // 12) 주문하기 버튼 다시 활성화
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  });

  // ==========================================================================
  // [이벤트 리스너] 다시 작성 (Reset) 처리
  // ==========================================================================
  orderForm.addEventListener('reset', () => {
    setTimeout(() => {
      // 기본값 복원 (M 사이즈, 수량 1)
      quantityInput.value = 1;
      const defaultSizeRadio = document.getElementById('sizeM');
      if (defaultSizeRadio) {
        defaultSizeRadio.checked = true;
      }

      // 예상 금액 초기화
      calculateTotal();

      // 주문 확인 메시지 숨김 (※ 주문 내역 orders 배열은 지우지 않고 유지)
      orderConfirmation.textContent = '';
      orderConfirmation.hidden = true;
    }, 0);
  });

  // ==========================================================================
  // [이벤트 리스너] 주문 내역 전체 삭제 (내역 모두 지우기)
  // ==========================================================================
  clearAllBtn.addEventListener('click', () => {
    if (orders.length === 0) return;

    const isConfirmed = confirm('모든 주문 내역을 삭제하시겠습니까?');
    if (isConfirmed) {
      orders = []; // 배열 비우기
      renderOrders(); // 화면 갱신
    }
  });

  // 초기 렌더링 및 금액 계산 실행
  calculateTotal();
  renderOrders();
});
