# Replay / Edit Replay — điều tra và phương án cải thiện

Ngày: 2026-10-26 · Travel Life · BMAD party review, session mode.

Trạng thái: hoàn tất rà soát source và đề xuất. Chưa triển khai thay đổi production; chưa đo latency hoặc xác nhận sửa lỗi trên thiết bị. Báo cáo dựa trên checkout hiện tại tại `C:\Users\vothi\Desktop\Travel Life`, không dựa vào bản ghi nhớ cũ để kết luận trạng thái code.

## Kết luận

Trải nghiệm hiện tại buộc người dùng đi qua cùng một nút thắt lưu nhiều lần: chọn media → lưu working draft → Done chờ lưu → Update chờ lưu → commit → tải lại → render. Nhiều bản sửa gần đây cải thiện phản hồi hiển thị nhưng chưa xử lý toàn bộ vòng đời tác vụ lưu. Đề xuất giữ bố cục trip overview/gallery đã duyệt, thay bộ điều phối edit/save và tải preview theo viewport. Không cần thiết kế lại toàn bộ Replay.

Ưu tiên đầu tiên là tính đúng và khả năng kết thúc/recover của save, sau đó là first-visible-media và audio readiness. Không đánh đổi việc giữ đầy đủ edits, phạm vi riêng tư hoặc chất lượng video lấy tốc độ hiển thị.

## BMAD party: những điểm va chạm có ích

📋 **John:** “Người dùng muốn sửa vài trip rồi xem Replay mới. Có ba lần trông giống Save là quá nhiều. Done đóng tác vụ con; Update tạo bản mới.”

🎨 **Sally:** “Cho Done quay lại ngay chưa đủ nếu overview đón người dùng bằng nút Update xám vô thời hạn. Giữ thao tác tiến tới rõ ràng, đưa việc chờ vào đúng hành động đang thực hiện.”

🏗️ **Winston:** “Cho bấm Update được không có nghĩa được render bản chưa lưu. Cần một snapshot hoàn chỉnh, xác nhận lưu, rồi mới render. Không giải quyết khóa bằng cách cho SQLite ghi song song.”

💻 **Amelia:** “Và timeout ở JavaScript không hủy native write. Retry khi chưa biết lần trước đã commit hay chưa có thể tạo race mới. Phải đối soát acknowledgement trước.”

📊 **Mary:** “Tách bằng chứng: đã xác nhận các dependency và nhánh khóa trong source; chưa xác định writer nào giữ khóa trên điện thoại. Không gọi bộ test pass là hết hiện tượng owner gặp.”

## Bản đồ flow hiện tại

| Bước | Hành vi hiện tại | Điểm gây ma sát |
| --- | --- | --- |
| Atlas → Replay | Kiểm tra scope/cache; có cache thì phát trước rồi hydrate editor | Cache đã có fast path; không nên làm mất lợi ích này |
| Mở Edit | Dùng manifest gồm tất cả trip/media, provider resolve tối đa 48 preview đầu | Preview đầu lấy theo thứ tự toàn Replay, không ưu tiên cover mỗi trip hoặc trip sắp mở |
| Mở một trip | Render grid; resolve trang 48 item, tối đa 6 lane | Cả trang chỉ trả sau khi tất cả worker hoàn tất; tile nhanh vẫn chờ tile chậm |
| Chọn/bỏ media | Cập nhật UI, debounce 250 ms, stage toàn bộ draft | Chỉ gộp request chưa bắt đầu; các request đã nối vào promise chain vẫn chạy |
| Exclude trip → sửa trip khác | Dùng refs cho scope/media, tiếp tục stage | Mọi save phải chờ import/maintenance, load lại toàn manifest rồi ghi |
| Done trip | Trả về overview ngay, tiếp tục đợi selection/save | Có thể mở trip khác, nhưng Update chỉ enabled khi save state là idle |
| Nhạc | Picker copy vào cache → copy vào document → kiểm tra file → stage draft | File readiness đã tách khỏi save; Settings Done vẫn đợi toàn save queue |
| Update Replay | Flush → chụp refs → commit/readback → prepare | Không có một coordinator sở hữu snapshot và toàn bộ selected-media task boundary |
| Back/gesture | Header gallery trả về ngay; hardware Back và beforeRemove chờ retainWorkingEdits | Cùng ý định quay lại nhưng hành vi khác nhau |
| Share | Chọn riêng từ composition đã commit, chuẩn bị export riêng | Giữ ranh giới này; không tự chia sẻ working draft |

## Findings và bằng chứng

Đường dẫn dưới đây tương đối với checkout Travel Life. Số dòng là tại lần đọc ngày 2026-10-26.

### F1 · P0 · Update bị phụ thuộc vào hàng đợi không có thời hạn kết thúc

**Đã xác nhận trong source.** `components/replay-screen.tsx:353–397` nối save vào `workingSaveQueue`; không có deadline/cancellation/unknown-outcome state. `:817` khóa Update khi `workingSaveState !== 'idle'`. `:582` cho Done trả về overview ngay nhưng vẫn chờ queue ở nền. Một promise không settle có thể giữ queue và nút Update chờ mãi. Debounce 250 ms có sẵn; chỉ thêm debounce sẽ không giải quyết đầu hàng đợi bị giữ.

**Chưa xác định:** promise nào giữ lâu trên thiết bị của owner ở lần tái hiện mới nhất.

### F2 · P0 · Lưu draft đang chờ toàn bộ công việc nền, rồi dựng lại manifest lớn

**Đã xác nhận.** `photo-access/provider.tsx:823–868`: cả stage và commit đợi `controller.whenImportIdle()` rồi `maintenanceController.whenIdle()`. Stage load lại native manifest trước mỗi write. Commit còn load manifest trước và sau write để kiểm tra. `reconstruction/repository.ts:1004–1150` dựng Journey List projection, đọc draft và query media riêng cho từng trip. Đây là metadata/SQL cost; stage không resolve 48 thumbnail qua provider nên không quy nhầm toàn bộ chi phí stage cho tải ảnh.

`photo-access/controller.ts:44` và `maintenance/controller.ts:24` trả promise của cả transition; đây không phải chỉ chờ một transaction ngắn. `database/native-transaction.ts` còn có FIFO gate cho explicit transactions. Reconstruction/import dùng `PRAGMA busy_timeout = 30000`.

**Bằng chứng lịch sử ngay trong repo:** error-playbook ngày 2026-10-26 đã ghi nhận `DATABASE_BUSY` sau busy timeout; writer giữ khóa vẫn chưa được định danh. Không suy ra deadlock cụ thể hay khẳng định tác vụ nền chính là lock holder.

### F3 · P1 · Tải gallery song song nhưng vẫn trả kết quả cả trang một lần

**Đã xác nhận.** `photo-access/native-adapter.ts:28–56` dùng sáu lane nhưng `await Promise.all(...)` trước khi trả page. `replay-screen.tsx:538–555` chỉ cập nhật tile sau promise page. Một asset rất chậm kéo dài first-visible-preview của các asset nhanh trong cùng trang. Cũng chưa có shared in-flight dedupe giữa page load, tap-resolve và bulk selection.

Provider `:651` resolve 48 reference đầu của toàn manifest. `editorPreviewLoading` là cờ toàn editor, không theo trip: mở B khi A còn tải có thể bỏ qua yêu cầu đầu của B; hiện còn Load more để thử lại. Cần regression chuyển trip nhanh trước khi kết luận mức độ ảnh hưởng thực tế.

### F4 · P1 · Thumbnail video và dữ liệu render dùng đường tải quá gần nhau

**Đã xác nhận.** `ReplayVideoPoster` trong `replay-screen.tsx` tạo video player và tạo thumbnail từ URI cho tile. Ảnh dùng URI của asset và `cachePolicy="memory"`. Không có thumbnail service dùng chung, cache theo kích thước/revision và scheduler ưu tiên viewport. FlatList có virtualization; không được gọi đây là lỗi mount toàn bộ thư viện.

**Rủi ro cần đo:** native decoder contention, kích thước ảnh decode, chi phí remount/poster khi cuộn. Chưa có heap/frame/timing trace để lượng hóa.

### F5 · P1 · Nhạc có hai lần copy; Done vẫn gắn với save của cả editor

**Đã xác nhận.** `replay-screen.tsx:215–277`: picker dùng `copyToCacheDirectory: true`, sau đó copy sang document directory; còn `getInfoAsync` kiểm tra kích thước. Readiness được báo ngay sau copy — đã sửa một phần. `:611–633` Settings Done vẫn flush/retry queue chung; header Back disabled khi `settingsSaving`, trong khi modal system-close có đường dismiss riêng.

Không khẳng định hai lần copy là bottleneck chính: provider của document picker hoặc writer có thể chiếm phần lớn thời gian. Kiểm tra extension/size không phải bằng chứng file chắc chắn decode được; lỗi decode cần được báo đúng, không rơi về “renderer unavailable” chung chung.

### F6 · P1 · Back/recovery chưa thống nhất và thiếu hàng rào cho request chưa chạy

**Đã xác nhận.** Gallery header Back/Done dùng `returnToTripOverview`, nhưng hardware Back `:730` và `beforeRemove :751` chờ `retainWorkingEdits` trước khi chuyển màn. Overview Back cũng chờ save. Settings Back chỉ dismiss, các thay đổi đã stage vẫn còn; không có subdraft để hủy riêng setting chưa Done.

`restoreSavedReplaySelection :496` và `applyMineAfterConflict` đợi `workingSaveQueue`, nhưng không cùng sử dụng boundary bao gồm `scheduledWorkingSave` như retain. Request còn nằm trong timer 250 ms có nguy cơ stage sau thao tác Restore. Đây là finding race từ source, chưa có device reproduction.

### F7 · P1 · State và freshness đang phân tán giữa UI/provider/repository

**Đã xác nhận.** State UI, refs, working revision, composition revision, in-memory opaque maps và preparation generation được nhiều handler sửa riêng. Stage provider thay expected working revision bằng revision vừa đọc ở native trước write (`provider.tsx:858–868`). Việc này hỗ trợ runtime reload, nhưng một revision mới không tự chứng minh nội dung mới thuộc cùng phiên edit. Cần session ownership để phân biệt tự phục hồi và draft bị thay bởi tác vụ khác; không bỏ CAS.

`saveEdits :634` flush queue, rồi chụp toàn bộ refs và provider readback — đây là bảo vệ có ích đang tồn tại. Tuy nhiên handler không trực tiếp drain `pendingSelectionTasks` bằng cùng boundary như retain. Update state gate cũng không trực tiếp kiểm tra tập task này. Cần regression task media đang resolve + Update để xác nhận lỗ hổng trước sửa.

### F8 · P2 · Tính toán toàn composition trong render và copy chữ quá nhiều

Overview lặp filter/includes qua memories cho từng trip, `keysByGroup` sao chép mảng trên mỗi insert rồi stringify để tìm thay đổi (`:783–790`). Đây là điểm có thể tăng CPU với album lớn; chưa đo là nguyên nhân chính của dropped frames. Settings và footer còn lặp lại nhiều trạng thái dạng câu. UI nên dùng nội dung, checkmark và một dòng trạng thái ngắn.

## Phương án chọn

### 1. Một Replay edit session sở hữu toàn bộ bản nháp

Đưa session ra khỏi component sang controller/service có reducer và lifecycle rõ ràng. Giữ các lớp tách biệt: `working composition`, `durably acknowledged composition`, `rendered artifact`. Preview URI/loading không được làm thay đổi composition identity.

Session có `sessionId`, `editVersion`, `acknowledgedVersion`, `saveState`, `updateRequest`. Tất cả media, trip inclusion, automatic/manual mode, order và soundtrack thuộc cùng một immutable snapshot. Selection tasks, deferred save và recovery cùng do session quản lý. UI chỉ gửi action và hiển thị state; tránh các handler tự flush/reset/reconcile mỗi nơi một cách.

### 2. Writer: tối đa một write đang chạy và một snapshot mới nhất đang đợi

Khi write V1 đang chạy, V2/V3/V4 chỉ cập nhật pending snapshot V4; không nối thêm ba expensive preflight jobs. Khi V1 được xác nhận, ghi V4. Những waiter của V2/V3 được settle khi một version mới hơn đã bao phủ intent của chúng. Không coalesce qua Update/Restore/session boundary.

Dùng một transaction API có ownership, release bằng try/finally và short transactions, giữ serialization cho `useNewConnection`. Tác vụ foreground được ưu tiên tại điểm transaction tiếp theo; không ngắt transaction đang mở. Background có giới hạn chờ công bằng để không bị đói. Privacy/lifecycle operations giữ quyền ưu tiên cần thiết; revalidate sau khi lấy writer turn.

Thay việc chờ toàn import/maintenance bằng đúng writer safe boundary. Bỏ full-manifest preflight cho mỗi tap: resolve opaque tokens qua session mapping có version; kiểm tra generation/privacy/composition revision bằng query nhỏ trong write boundary. Khi runtime mất mapping thì rehydrate một lần và đối soát session; generation/privacy đổi thì invalidate/rebase có chủ đích. Commit vẫn có exact readback.

Không mặc định mở database thứ hai, bỏ transaction gate, hoặc tăng busy timeout để che vấn đề.

### 3. Update luôn là một hành động rõ ràng khi có thay đổi hợp lệ

Cho phép bấm Update khi autosave đang pending/saving. Lần bấm ghi nhận đúng một yêu cầu update, chuyển CTA sang `Updating…`, rồi coordinator chờ đúng version được yêu cầu. Không render trước durable acknowledgement. Chỉ disable khi không thay đổi, không còn trip, đang recovery bắt buộc hoặc đã có update request.

Trước capture: chặn edit mới trong commit boundary ngắn, settle các selected-media task liên quan với deadline và đối soát intent, flush snapshot hoàn chỉnh. Pending thumbnail không liên quan không chặn commit. Nếu media đã chọn không truy cập được, giữ lựa chọn và yêu cầu owner quyết định; không tự bỏ media để cho render qua.

Sau commit/readback: render immutable composition version đó, reuse chapter đúng identity; thay đổi thứ tự có thể chỉ cần remux khi chapter inputs không đổi; đổi nhạc cần mux/audio work nhưng không encode lại hình nếu tương thích. Giữ video cũ để xem trong thời gian render khi còn hợp lệ về privacy. Video cũ phải được phân biệt rõ với version đang tạo, không báo edits đã hiển thị trước khi artifact mới được xác minh.

### 4. Save chậm có lối thoát, không giả vờ đã hủy native write

State nội bộ: `clean → dirty → saving → saved`, hoặc `waiting / failed / conflict / outcome-unknown`. Quan sát queue wait, SQL begin/commit/rollback và readback riêng.

Deadline trước transaction: gỡ yêu cầu chưa bắt đầu an toàn. Khi write đã chạy mà quá thời hạn UI: coi kết quả chưa biết; không release lock giả, không cho retry ghi chồng. Giữ session và đối soát theo operation ID/version trước khi cho Retry. Promise.race chỉ đổi UI, không hủy SQLite.

Người dùng luôn có thể quay về overview/xem video cũ. Trước khi đóng hẳn phiên chưa có durable acknowledgement, giữ session service sống hoặc hiển thị lựa chọn ngắn `Keep editing / Discard`; không nói đã saved và không âm thầm bỏ draft. Draft đã xác nhận phải khôi phục sau restart. Draft chưa được xác nhận không được hứa sống sót qua OS kill.

`Restore saved Replay` phải hủy timer chưa chạy, fence callbacks cũ, reconcile write đang chạy, rồi reset/readback. Kết quả cũ không được revive selection đã discard.

### 5. Tải media theo vùng nhìn thấy, trả từng nhóm nhỏ

Manifest chứa metadata/composition; hydration thumbnail là background riêng. Overview ưu tiên một cover cho mỗi trip đang nhìn thấy. Gallery ưu tiên khoảng 12–18 tile trên màn; streaming 4–8 kết quả mỗi batch, tiếp tục trang metadata 48 item và prefetch một vùng kế tiếp. Đây là engineering starting values, cần điều chỉnh theo thiết bị.

Giữ concurrency cap hiện tại làm baseline, không tăng tùy tiện. Dedupe request theo asset + scope revision + requested size; cache private thumbnail bounded theo byte/LRU. URI cache cần kiểm tra lại permission/privacy; clear khi disconnect/lifecycle. Dùng thumbnail riêng cho video, không tạo player cho từng ô; chỉ tạo player khi Inspect/Watch. Decode original phục vụ render tách khỏi thumbnail queue.

Request theo trip/page có generation/cancellation; bỏ ưu tiên request màn cũ, không đánh dấu asset unavailable chỉ vì timeout tạm thời. Retry từng tile/page. Không tải toàn thư viện để mở trip, không giới hạn selection bằng số item trong page/cache, không silently omit unknown/undated/explicitly selected media.

### 6. Nhạc: chọn, nhận diện, áp dụng

Hiển thị ngay tên file + activity ngắn sau picker trả kết quả; sau khi app-private file sẵn sàng thì checkmark. Tách `file ready`, `draft acknowledged`, `render audio verified`. Một dòng tên file và nút thay file là đủ; lỗi nằm cạnh lựa chọn.

Đo picker/provider copy và private copy riêng trước tối ưu. Trước mắt giữ cách copy tương thích; chỉ bỏ copy cache nếu đã chứng minh URI lifetime/readability trên iOS và Android. File quá 5,000,000 byte hoặc định dạng không hỗ trợ vẫn bị từ chối. Kiểm tra khả năng decode có timeout/recovery riêng; không bắt gallery chờ FFmpeg. Dọn file hủy/thay sau khi chắc không còn draft/artifact tham chiếu, không xóa nhạc đang dùng.

Music sheet có subdraft: Done áp dụng vào edit session và đóng ngay; Back/gesture hủy thay đổi chưa Done trong sheet. Đây là đề xuất chỉnh interaction cụ thể cần đưa vào spec và mock duyệt, vì code hiện tại Back chỉ dismiss còn draft đã đổi. Overview Back tiếp tục giữ working draft như design-system đã duyệt.

## UI lean được đề xuất

| Màn | Nội dung và action |
| --- | --- |
| Watch | Video là chính. `Edit`; `Share` riêng. Mute/fullscreen chung một hàng như đã duyệt |
| Edit overview | `‹ Back · Edit Replay`; mỗi row có cover, tên trip, tháng, selected count và inclusion checkbox độc lập với vùng mở gallery |
| Gallery | Header cố định `‹ Back · Trip · Done`; `All / Selected / …`; grid nhận diện được, checkmarks; inspect riêng không đổi selection |
| More | Auto selection cho trip, Select all, Clear, Undo; giữ action ít dùng ở đây |
| Music & order | Một row tên track + Change; segmented order. `Back · Music & order · Done`; không có chuỗi Saved/Loaded/Background music lặp nhau |
| Overview footer | Một dòng trạng thái khi cần (`Saving…`, `Not saved · Retry`); một CTA `Update Replay` |
| Rendering | Tiến độ đo thật hoặc indeterminate. Có đường quay lại, giữ lựa chọn và video cũ hợp lệ |

Trip bị exclude vẫn giữ selection để Include lại không phải chọn từ đầu. Zero selected vẫn cho trip card, không biến album có ảnh thành trống. All excluded: hiện `Choose a trip`, không để CTA xám không lý do. Idle/no changes: CTA có thể disabled; không cần đoạn hướng dẫn dưới mọi trip.

## Các lát triển khai theo thứ tự

1. **P0 — trace và sửa writer/save lifecycle.** Thêm fixed stage diagnostics, xác định lock holder bằng synthetic contention, deadline/reconciliation, coalesce một in-flight + một pending. Hoàn thành cả blocked writer và late completion trước đổi CTA.
2. **P0 — session và update atomic.** Chuyển toàn bộ mutation qua session, snapshot/readback và recovery fencing; Update nhận request trong lúc save pending, Back nhất quán. Không sửa trạng thái nút đơn lẻ rồi gọi xong.
3. **P1 — gallery first-visible.** Metadata/preview split, viewport priorities, incremental results, thumbnail service, dedupe/cancellation/cache; index selected IDs/group counts để giảm CPU render.
4. **P1 — nhạc và lean UI.** Sheet subdraft, readiness states, concise rows và primary action; giữ approved gallery composition.
5. **P1 — device acceptance toàn flow.** Android/iOS, real large album/custom audio và contention; đóng các incident chỉ khi có bằng chứng.

## Mục tiêu đo và acceptance

Các số dưới đây là mục tiêu đề xuất, chưa phải kết quả hiện tại. Đo release-like build, cold/warm riêng, p50/p95 và mẫu thiết bị/dataset rõ ràng. Tối thiểu 20 lần cho mỗi kịch bản trọng tâm trên mỗi platform; cloud-provider latency tách khỏi app-local latency.

| Hành vi | Mục tiêu |
| --- | --- |
| Tap selection/inclusion, Done/Back | Phản hồi visual p95 ≤150 ms; không chờ SQL để chuyển tác vụ con |
| Mở gallery local warm | Tile nhận diện đầu tiên p95 ≤500 ms; cold local ≤1.5 s làm mục tiêu ban đầu |
| Draft save khi không contention | Acknowledgement p95 ≤1 s; không full-manifest/photo resolve per tap |
| Writer chờ lâu | Sau khoảng 2 s hiển thị chờ; sau khoảng 8 s có recovery state. Đây là ngưỡng UX, không native cancellation |
| Audio | Tên file xuất hiện ≤150 ms sau picker trả kết quả; private copy/validation đo riêng theo storage/provider |
| Update trong lúc save | Một lần bấm được ghi nhận; không disabled vô hạn; đúng complete snapshot được render |
| Render | Không re-encode chapter không đổi; chất lượng/framing/audio/Unicode và selection tương đương manifest đã commit |

Acceptance bắt buộc:

- Edit A → exclude A → Done → edit B → Done → Update: A không quay lại, B đúng selections, một snapshot durable và artifact đúng snapshot.
- 100 tap khi write đầu đang held: tối đa một in-flight và một latest pending; tất cả waiter settle đúng, không mất lần tap cuối.
- Write không settle, busy rejection, late commit, runtime reload, background/resume: có điều hướng/recovery; không báo Saved giả, không duplicate mutation.
- Tap unknown media rồi Update, Done hay Back ngay: không bỏ intent; không dùng full gallery load làm commit barrier.
- Restore trong debounce 250 ms và trong native write đang chạy: callback/timer cũ không phục hồi edits đã bỏ.
- Mở A rồi B nhanh, một asset rất chậm: tile nhanh ở B xuất hiện, selection/scroll A được giữ, late A không ghi đè B.
- Settings Done áp dụng, Back hủy subdraft; native/system Back cùng nghĩa với header; chọn file mới khi copy cũ chưa xong không bị kết quả cũ ghi đè.
- 0 selected, all excluded, Include lại, Reset/Auto/Undo, direction, unknown-date media và custom soundtrack đều có test đúng semantics.
- App restart giữ draft đã acknowledged; cache/permission/privacy invalidation không hiển thị nội dung bị thu hồi; sharing chỉ từ version đã review.
- Viewport 320/360/390/430 px, large text, screen reader, reduced motion; header/footer không clip và grid chỉ có một vertical scroll owner.

## Verification đã thực hiện

- BMAD customization/core/roster resolvers chạy thành công; installed agents resolved = true, session mode. Đây là các góc nhìn trong một phiên, không phải independent multi-agent review.
- Đọc current screen/provider/native adapter/repository/transaction gate/controllers, design-system, project-state và error-playbook. Các bản sửa gần đây đã được phân biệt với phần chưa giải quyết.
- Replay screen Jest: lần đầu 48 pass / 1 timeout ở test mở durable cache với ngưỡng mặc định 5 s. Chạy lại suite với cache đã warm và `--testTimeout=15000`: **49/49 pass**, 8.947 s. Chưa cô lập được timeout do cold transform, scheduling hay harness; không coi tăng timeout là sửa product.
- Root `npm run check` pass: framework integrity, 20 foundation tests và eval infrastructure smoke. Không có AI-quality claim.
- Mock tương tác dùng dữ liệu/landscape tổng hợp: JavaScript syntax và state assertions pass cho exclude A → edit B, Update trong lúc save pending, delayed-save recovery, settings Back cancel/Done apply, all-excluded và render completion. Chưa kiểm tra bố cục bằng browser hoặc viewport thật; đây không phải app đang chạy và không lưu media thực. Một lỗi duplicate class attribute trong helper của mock đã được sửa trước kiểm tra; không ảnh hưởng source mobile.
- Không chạy native build, không khởi động lại Metro/app, không clear storage, không đọc/export ảnh riêng tư hoặc raw device logs. Chưa có device benchmark hoặc xác nhận owner.
- `git status` kể cả explicit git-dir/work-tree bị từ chối “must be run in a work tree”; chưa xác định nguyên nhân. Không dùng lỗi đó để kết luận checkout clean/dirty; không stage/commit/push.

## Incident log của lượt review

Owner report về save/load/Update vẫn **open**, liên kết với incident Replay trip exclusion và database-busy ngày 2026-10-26 trong repo. Review chỉ xác nhận architecture path có thể tạo triệu chứng, chưa xác định runtime lock holder.

Read-only tooling mistakes: thử đọc `.git` như file trong khi là directory; dùng wildcard path với rg trên Windows; giả định `.git/config.worktree` và `database/native-schema.ts` tồn tại. Không có product file bị thay đổi bởi các lệnh lỗi. Phòng ngừa: discovery `rg --files`/Test-Path trước khi mở; truyền directory cho rg; kiểm tra file-vs-directory. Git work-tree error không được gán là bug agent/product khi nguyên nhân chưa rõ. Test timeout được ghi riêng ở verification, không giấu bằng lần rerun pass.

## Giới hạn quyết định

Đây là một solution đề xuất có thể chuyển sang BMAD spec/build; không coi là implementation đã được nghiệm thu. Thiết kế giữ một Update Replay cấp tổng, giữ gallery đã duyệt và ranh giới chia sẻ riêng. Product refinements cần được thể hiện trong delivery spec khi build: settings Back cancels subdraft, Update có thể nhận request lúc autosave pending, visible trip inclusion trên overview. Không cần thêm quyết định framework hoặc chọn lại renderer để giải quyết scope này.
