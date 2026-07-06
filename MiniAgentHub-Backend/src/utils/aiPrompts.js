module.exports = {
    FILE_READ_ERRORS: {
        PDF_PARSE_ERROR: "(Hệ thống không thể đọc được nội dung văn bản từ file PDF này. Có thể đây là file ảnh scan hoặc bị hỏng định dạng.)",
        OCR_NO_TEXT: "(Không tìm thấy chữ/văn bản nào trong hình ảnh.)",
        OCR_FORMAT_ERROR: "(Hệ thống không thể trích xuất văn bản từ hình ảnh này do lỗi định dạng.)",
        UNSUPPORTED_FORMAT: (filename) => `(Hệ thống không thể đọc nội dung chi tiết của định dạng file này. Tên file đính kèm: ${filename})`,
        GENERAL_ERROR: "(Hệ thống không thể đọc nội dung file này)"
    },

    SYSTEM_PROMPTS: {
        GENERATE_TITLE: 'You are an AI that summarizes messages into a short title (max 4 words). CRITICAL: The title MUST be in the EXACT SAME LANGUAGE as the user message. If the user writes in English, reply in English. If the user writes in Vietnamese, reply in Vietnamese. ONLY output the title string without quotes or prefixes.',
        
        BASE_SYSTEM_PROMPT: 'Bạn là một trợ lý AI thông minh, nhiệt tình của Neural Hub. Luôn trả lời bằng Tiếng Việt, định dạng văn bản rõ ràng bằng Markdown.',
        
        GLOBAL_CONTEXT_PREFIX: (contextStr) => `Dưới đây là thông tin từ các cuộc trò chuyện ở các phiên khác của người dùng để bạn tham khảo ngữ cảnh (Ký ức dài hạn):\n"""\n${contextStr}\n"""`
    },

    ATTACHMENT_PROMPTS: {
        OCR_CONTEXT: (extractedText, userMessage) => `Người dùng đã tải lên (các) hình ảnh/tài liệu. Hệ thống nhận diện (OCR) đã quét và trích xuất được văn bản sau từ các file đó:\n"""${extractedText}"""\n\nDựa vào phần chữ đã được hệ thống trích xuất ở trên, hãy trả lời yêu cầu sau của người dùng. Tuyệt đối KHÔNG được từ chối hoặc nói rằng bạn không thể nhìn thấy hình ảnh:\n\nYêu cầu: ${userMessage}`,
        
        VISION_REQUIREMENT: `\n\n[HƯỚNG DẪN BẮT BUỘC CHO AI]: Đây là yêu cầu phân tích hình ảnh. Bạn BẮT BUỘC phải: 1. KHÔNG đoán mò, chỉ trả lời dựa trên những gì nhìn thấy rõ. 2. Đọc cẩn thận từng chi tiết, góc cạnh, chữ nhỏ và đường nối (nếu là sơ đồ). 3. Tự rà soát lại (double-check) xem thông tin có khớp với tổng thể ảnh không trước khi trả lời.`
    }
};
